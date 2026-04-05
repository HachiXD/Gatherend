import { NextResponse } from "next/server";
import { PlatformWarningStatus, ReportTargetType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import {
  loadScopedReportTargetContext,
} from "@/lib/moderation-report-context";
import { serializeUploadedAsset, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { reportId } = await params;

    if (!reportId || typeof reportId !== "string" || reportId.length > 191) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const report = await db.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: moderationProfileSelect,
        },
        targetOwner: {
          select: moderationProfileWithUserIdSelect,
        },
        resultingStrike: {
          select: {
            id: true,
            severity: true,
            reason: true,
            sourceType: true,
            autoBanTriggered: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const additionalContext = await loadScopedReportTargetContext({
      targetType: report.targetType,
      targetId: report.targetId,
    });

    let currentBoardMetadata: Record<string, unknown> | null = null;

    if (report.targetType === ReportTargetType.BOARD) {
      const board = await db.board.findUnique({
        where: { id: report.targetId },
        select: {
          id: true,
          name: true,
          description: true,
          isPrivate: true,
          inviteEnabled: true,
          createdAt: true,
          reportCount: true,
          riskPoints: true,
          riskLevel: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          profile: {
            select: moderationProfileSelect,
          },
        },
      });

      if (board) {
        currentBoardMetadata = {
          id: board.id,
          name: board.name,
          description: board.description,
          isPrivate: board.isPrivate,
          inviteEnabled: board.inviteEnabled,
          createdAt: board.createdAt.toISOString(),
          reportCount: board.reportCount,
          riskPoints: board.riskPoints,
          riskLevel: board.riskLevel,
          imageAsset: serializeUploadedAsset(board.imageAsset),
          owner: serializeModerationProfile(board.profile),
        };
      }
    }

    const [warningCounts, recentWarnings, recentPlatformActions, recentTargetStrikes] =
      report.targetOwnerId
        ? await Promise.all([
            db.platformWarning.groupBy({
              by: ["status"],
              where: { profileId: report.targetOwnerId },
              _count: { _all: true },
            }),
            db.platformWarning.findMany({
              where: { profileId: report.targetOwnerId },
              include: {
                issuedBy: {
                  select: moderationProfileSelect,
                },
                removedBy: {
                  select: moderationProfileSelect,
                },
                promotedToStrike: {
                  select: {
                    id: true,
                    severity: true,
                    sourceType: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 10,
            }),
            db.platformModerationAction.findMany({
              where: { profileId: report.targetOwnerId },
              include: {
                issuedBy: {
                  select: moderationProfileSelect,
                },
                warning: {
                  select: {
                    id: true,
                    reason: true,
                    notes: true,
                    status: true,
                    removedAt: true,
                    promotedToStrikeId: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 10,
            }),
            db.strike.findMany({
              where: { profileId: report.targetOwnerId },
              select: {
                id: true,
                reason: true,
                severity: true,
                sourceType: true,
                autoBanTriggered: true,
                createdAt: true,
                expiresAt: true,
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 10,
            }),
          ])
        : [[], [], [], []];

    const warningStats = report.targetOwnerId
      ? {
          active:
            warningCounts.find(
              (entry) => entry.status === PlatformWarningStatus.ACTIVE,
            )?._count._all ?? 0,
          promoted:
            warningCounts.find(
              (entry) => entry.status === PlatformWarningStatus.PROMOTED,
            )?._count._all ?? 0,
          removed:
            warningCounts.find(
              (entry) => entry.status === PlatformWarningStatus.REMOVED,
            )?._count._all ?? 0,
        }
      : null;

    return NextResponse.json({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      boardId: report.boardId,
      channelId: report.channelId,
      category: report.category,
      status: report.status,
      priority: report.priority,
      description: report.description,
      resolution: report.resolution,
      actionTaken: report.actionTaken,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      resultingStrike: report.resultingStrike
        ? {
            ...report.resultingStrike,
            createdAt: report.resultingStrike.createdAt.toISOString(),
          }
        : null,
      createdAt: report.createdAt.toISOString(),
      reporter: serializeModerationProfile(report.reporter),
      targetOwner: serializeModerationProfile(report.targetOwner),
      warningStats,
      recentWarnings: recentWarnings.map((warning) => ({
        ...warning,
        issuedBy: serializeModerationProfile(warning.issuedBy),
        removedBy: serializeModerationProfile(warning.removedBy),
        createdAt: warning.createdAt.toISOString(),
        updatedAt: warning.updatedAt.toISOString(),
        removedAt: warning.removedAt?.toISOString() ?? null,
        promotedToStrike: warning.promotedToStrike
          ? {
              ...warning.promotedToStrike,
              createdAt: warning.promotedToStrike.createdAt.toISOString(),
            }
          : null,
      })),
      recentPlatformActions: recentPlatformActions.map((action) => ({
        ...action,
        issuedBy: serializeModerationProfile(action.issuedBy),
        createdAt: action.createdAt.toISOString(),
        warning: action.warning
          ? {
              ...action.warning,
              createdAt: action.warning.createdAt.toISOString(),
              updatedAt: action.warning.updatedAt.toISOString(),
              removedAt: action.warning.removedAt?.toISOString() ?? null,
            }
          : null,
      })),
      recentTargetStrikes: recentTargetStrikes.map((strike) => ({
        ...strike,
        createdAt: strike.createdAt.toISOString(),
        expiresAt: strike.expiresAt?.toISOString() ?? null,
      })),
      snapshot: report.snapshot as Record<string, unknown>,
      currentBoardMetadata,
      ...additionalContext,
    });
  } catch (error) {
    console.error("[MODERATION_REPORT_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
