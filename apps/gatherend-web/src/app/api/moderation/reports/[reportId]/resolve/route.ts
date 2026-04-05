import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { PlatformBanSourceType, ReportStatus, StrikeSourceType } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { PROFILE_REPUTATION_DELTAS } from "@/lib/domain";
import {
  applyBoardRiskFromValidatedReport,
  getStrikeSeverityForReportPriority,
  incrementReporterStats,
  issuePlatformStrike,
  issuePlatformWarning,
} from "@/lib/platform-moderation";

const VALID_ACTIONS = ["dismiss", "warning", "strike", "ban"] as const;
type ResolveAction = (typeof VALID_ACTIONS)[number];

function isValidOptionalString(
  value: unknown,
  maxLength: number,
): value is string | undefined {
  return (
    value === undefined || (typeof value === "string" && value.length <= maxLength)
  );
}

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = await requireAdmin();
    if (!admin.success) return admin.response;

    const { reportId } = await params;

    if (!reportId || typeof reportId !== "string" || reportId.length > 191) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      action,
      reason,
      notes,
      dismissAsFalseReport,
    } = (body ?? {}) as {
      action?: unknown;
      reason?: unknown;
      notes?: unknown;
      dismissAsFalseReport?: unknown;
    };

    if (
      typeof action !== "string" ||
      !VALID_ACTIONS.includes(action as ResolveAction)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!isValidOptionalString(reason, 500)) {
      return NextResponse.json(
        { error: "Reason must be 500 characters or less" },
        { status: 400 },
      );
    }

    if (!isValidOptionalString(notes, 2000)) {
      return NextResponse.json(
        { error: "Notes must be 2000 characters or less" },
        { status: 400 },
      );
    }

    if (
      dismissAsFalseReport !== undefined &&
      typeof dismissAsFalseReport !== "boolean"
    ) {
      return NextResponse.json(
        { error: "dismissAsFalseReport must be a boolean" },
        { status: 400 },
      );
    }

    const validAction = action as ResolveAction;

    const result = await db.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          targetOwner: {
            select: {
              id: true,
              reputationScore: true,
              banned: true,
            },
          },
          reporter: {
            select: {
              id: true,
              reputationScore: true,
            },
          },
          resultingStrike: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!report) {
        throw new Error("NOT_FOUND");
      }

      if (report.status !== "PENDING" && report.status !== "REVIEWING") {
        throw new Error("ALREADY_RESOLVED");
      }

      if (
        report.resultingStrike &&
        (validAction === "strike" || validAction === "ban")
      ) {
        throw new Error("REPORT_ALREADY_HAS_STRIKE");
      }

      let newStatus: ReportStatus;
      let actionTaken: string;
      let resolution: string;

      switch (validAction) {
        case "dismiss": {
          newStatus = ReportStatus.DISMISSED;
          actionTaken = "none";
          resolution = notes?.trim() || "Report dismissed - no action taken";

          await incrementReporterStats(tx, {
            reporterId: report.reporterId,
            falseDelta: dismissAsFalseReport ? 1 : 0,
            applyReputationDelta: dismissAsFalseReport
              ? PROFILE_REPUTATION_DELTAS.falseReport
              : 0,
            reportId: report.id,
            boardId: report.boardId,
          });
          break;
        }

        case "warning": {
          if (!report.targetOwnerId || !report.targetOwner) {
            throw new Error("TARGET_OWNER_REQUIRED");
          }

          const warningReason = reason?.trim() || `${report.category} violation`;
          const warningNotes = notes?.trim() || null;

          await issuePlatformWarning(tx, {
            profileId: report.targetOwnerId,
            issuedById: admin.profile.id,
            reportId: report.id,
            reason: warningReason,
            notes: warningNotes,
          });

          await incrementReporterStats(tx, {
            reporterId: report.reporterId,
            validDelta: 1,
            applyReputationDelta: PROFILE_REPUTATION_DELTAS.validReport,
            reportId: report.id,
            boardId: report.boardId,
          });

          await applyBoardRiskFromValidatedReport(tx, report);

          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "warning";
          resolution = warningNotes || "Warning issued to user";
          break;
        }

        case "strike": {
          if (!report.targetOwnerId || !report.targetOwner) {
            throw new Error("TARGET_OWNER_REQUIRED");
          }

          const severity = getStrikeSeverityForReportPriority(report.priority);
          const strikeReason = reason?.trim() || `${report.category} violation`;
          const createdStrike = await issuePlatformStrike(tx, {
            profileId: report.targetOwnerId,
            issuedById: admin.profile.id,
            reason: strikeReason,
            severity,
            notes: notes?.trim() || null,
            reportId: report.id,
            boardId: report.boardId,
            originReportId: report.id,
            snapshot: report.snapshot as Prisma.InputJsonValue,
            contentType: report.targetType.toLowerCase(),
            sourceType: StrikeSourceType.DIRECT,
          });

          await incrementReporterStats(tx, {
            reporterId: report.reporterId,
            validDelta: 1,
            applyReputationDelta: PROFILE_REPUTATION_DELTAS.validReport,
            reportId: report.id,
            boardId: report.boardId,
          });

          await applyBoardRiskFromValidatedReport(tx, report);

          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "strike";
          resolution = notes?.trim() || "Strike issued to user";
          break;
        }

        case "ban": {
          if (!report.targetOwnerId || !report.targetOwner) {
            throw new Error("TARGET_OWNER_REQUIRED");
          }

          const banReason =
            reason?.trim() || `${report.category} violation - Report #${report.id}`;

          await tx.profile.update({
            where: { id: report.targetOwnerId },
            data: {
              banned: true,
              bannedAt: new Date(),
              banReason,
              banSourceType: PlatformBanSourceType.MANUAL,
            },
          });

          const createdStrike = await issuePlatformStrike(tx, {
            profileId: report.targetOwnerId,
            issuedById: admin.profile.id,
            reason: `${report.category} violation - resulted in ban`,
            severity: "CRITICAL",
            notes: notes?.trim() || banReason,
            reportId: report.id,
            boardId: report.boardId,
            originReportId: report.id,
            snapshot: report.snapshot as Prisma.InputJsonValue,
            contentType: report.targetType.toLowerCase(),
            sourceType: StrikeSourceType.DIRECT,
          });

          await incrementReporterStats(tx, {
            reporterId: report.reporterId,
            validDelta: 1,
            applyReputationDelta: PROFILE_REPUTATION_DELTAS.validReport,
            reportId: report.id,
            boardId: report.boardId,
          });

          await applyBoardRiskFromValidatedReport(tx, report);

          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "ban";
          resolution = notes?.trim() || "User banned from platform";
          break;
        }
      }

      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: newStatus,
          actionTaken,
          resolution,
          resolvedAt: new Date(),
          resolvedById: admin.profile.id,
        },
      });

      return updatedReport;
    });

    return NextResponse.json({
      success: true,
      report: {
        id: result.id,
        status: result.status,
        actionTaken: result.actionTaken,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (error.message === "ALREADY_RESOLVED") {
        return NextResponse.json(
          { error: "Report already resolved" },
          { status: 400 },
        );
      }

      if (error.message === "TARGET_OWNER_REQUIRED") {
        return NextResponse.json(
          { error: "This report cannot resolve to a user-targeted action" },
          { status: 400 },
        );
      }

      if (error.message === "REPORT_ALREADY_HAS_STRIKE") {
        return NextResponse.json(
          { error: "This report already produced a strike" },
          { status: 409 },
        );
      }
    }

    console.error("[MODERATION_REPORT_RESOLVE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
