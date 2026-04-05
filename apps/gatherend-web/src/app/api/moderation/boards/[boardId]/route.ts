import { NextResponse } from "next/server";
import { MemberRole, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import {
  loadBoardDeletionSnapshot,
  serializeBoardDeletionSnapshot,
  invalidateDeletedBoardState,
  notifyBoardDeleted,
} from "@/lib/board-deletion";
import { serializeUploadedAsset, UUID_REGEX, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const board = await db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true,
        inviteEnabled: true,
        hiddenFromFeed: true,
        reportCount: true,
        memberCount: true,
        riskPoints: true,
        riskLevel: true,
        createdAt: true,
        updatedAt: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        profile: {
          select: moderationProfileSelect,
        },
        members: {
          where: {
            role: {
              in: [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR],
            },
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          take: 25,
          select: {
            id: true,
            role: true,
            createdAt: true,
            profile: {
              select: moderationProfileSelect,
            },
          },
        },
        reports: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            targetType: true,
            category: true,
            status: true,
            priority: true,
            createdAt: true,
            reporter: {
              select: moderationProfileSelect,
            },
          },
        },
        riskEvents: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            delta: true,
            reason: true,
            sourceType: true,
            sourceId: true,
            createdAt: true,
            profile: {
              select: moderationProfileSelect,
            },
            report: {
              select: {
                id: true,
                targetType: true,
                category: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        platformBoardActions: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            actionType: true,
            notes: true,
            createdAt: true,
            issuedBy: {
              select: moderationProfileSelect,
            },
            sourceReport: {
              select: {
                id: true,
                targetType: true,
                category: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: board.id,
      name: board.name,
      description: board.description,
      isPrivate: board.isPrivate,
      inviteEnabled: board.inviteEnabled,
      hiddenFromFeed: board.hiddenFromFeed,
      reportCount: board.reportCount,
      memberCount: board.memberCount,
      riskPoints: board.riskPoints,
      riskLevel: board.riskLevel,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      imageAsset: serializeUploadedAsset(board.imageAsset),
      owner: serializeModerationProfile(board.profile),
      staff: board.members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
        profile: serializeModerationProfile(member.profile),
      })),
      recentReports: board.reports.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        reporter: serializeModerationProfile(report.reporter),
      })),
      recentRiskEvents: board.riskEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
        profile: serializeModerationProfile(event.profile),
        report: event.report
          ? {
              ...event.report,
              createdAt: event.report.createdAt.toISOString(),
            }
          : null,
      })),
      recentPlatformBoardActions: board.platformBoardActions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString(),
        issuedBy: serializeModerationProfile(action.issuedBy),
        sourceReport: action.sourceReport
          ? {
              ...action.sourceReport,
              createdAt: action.sourceReport.createdAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("[MODERATION_BOARD_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const {
      investigationId,
      sourceReportId,
      notes,
    } = (body ?? {}) as {
      investigationId?: unknown;
      sourceReportId?: unknown;
      notes?: unknown;
    };

    if (
      investigationId !== undefined &&
      (typeof investigationId !== "string" || investigationId.length === 0 || investigationId.length > 191)
    ) {
      return NextResponse.json(
        { error: "Invalid investigation ID" },
        { status: 400 },
      );
    }

    if (
      sourceReportId !== undefined &&
      (typeof sourceReportId !== "string" || sourceReportId.length === 0 || sourceReportId.length > 191)
    ) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    if (
      notes !== undefined &&
      (typeof notes !== "string" || notes.length > 2000)
    ) {
      return NextResponse.json(
        { error: "Notes must be 2000 characters or less" },
        { status: 400 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const board = await loadBoardDeletionSnapshot(tx, boardId);

      if (!board) {
        throw new Error("NOT_FOUND");
      }

      let resolvedInvestigationId: string | null = null;
      let resolvedSourceReportId: string | null =
        typeof sourceReportId === "string" ? sourceReportId : null;

      if (typeof investigationId === "string") {
        const investigation = await tx.boardInvestigation.findUnique({
          where: { id: investigationId },
          select: {
            id: true,
            boardId: true,
            sourceReportId: true,
            status: true,
          },
        });

        if (!investigation) {
          throw new Error("INVESTIGATION_NOT_FOUND");
        }

        if (investigation.boardId !== boardId) {
          throw new Error("INVESTIGATION_BOARD_MISMATCH");
        }

        if (
          resolvedSourceReportId &&
          resolvedSourceReportId !== investigation.sourceReportId
        ) {
          throw new Error("REPORT_INVESTIGATION_MISMATCH");
        }

        resolvedInvestigationId = investigation.id;
        resolvedSourceReportId = investigation.sourceReportId;
      }

      if (resolvedSourceReportId) {
        const report = await tx.report.findUnique({
          where: { id: resolvedSourceReportId },
          select: {
            id: true,
            boardId: true,
            status: true,
          },
        });

        if (!report) {
          throw new Error("REPORT_NOT_FOUND");
        }

        if (report.boardId !== boardId) {
          throw new Error("REPORT_BOARD_MISMATCH");
        }
      }

      const snapshot = serializeBoardDeletionSnapshot(board);

      const action = await tx.platformBoardAction.create({
        data: {
          boardId,
          issuedById: admin.profile.id,
          investigationId: resolvedInvestigationId,
          sourceReportId: resolvedSourceReportId,
          actionType: "DELETE",
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          boardSnapshot: snapshot as Prisma.InputJsonValue,
        },
        select: {
          id: true,
        },
      });

      if (resolvedInvestigationId) {
        await tx.boardInvestigation.update({
          where: { id: resolvedInvestigationId },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            closedById: admin.profile.id,
            notes:
              typeof notes === "string" && notes.trim()
                ? notes.trim()
                : undefined,
          },
        });
      }

      if (resolvedSourceReportId) {
        await tx.report.update({
          where: { id: resolvedSourceReportId },
          data: {
            status: "ACTION_TAKEN",
            actionTaken: "board_delete",
            resolution:
              typeof notes === "string" && notes.trim()
                ? notes.trim()
                : "Board deleted by platform moderation",
            resolvedAt: new Date(),
            resolvedById: admin.profile.id,
          },
        });
      }

      await tx.board.delete({
        where: { id: boardId },
      });

      return {
        actionId: action.id,
        snapshot,
        memberProfileIds: board.members
          .map((member) => member.profileId)
          .filter((profileId): profileId is string => !!profileId),
        channelIds: board.channels.map((channel) => channel.id),
      };
    });

    await invalidateDeletedBoardState(
      boardId,
      result.memberProfileIds,
      result.channelIds,
    );

    void notifyBoardDeleted(boardId, result.memberProfileIds, admin.profile.id);

    return NextResponse.json({
      success: true,
      deletedBoardId: boardId,
      actionId: result.actionId,
      boardSnapshot: result.snapshot,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      if (error.message === "INVESTIGATION_NOT_FOUND") {
        return NextResponse.json(
          { error: "Investigation not found" },
          { status: 404 },
        );
      }

      if (error.message === "REPORT_NOT_FOUND") {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (
        error.message === "INVESTIGATION_BOARD_MISMATCH" ||
        error.message === "REPORT_BOARD_MISMATCH" ||
        error.message === "REPORT_INVESTIGATION_MISMATCH"
      ) {
        return NextResponse.json(
          { error: "The provided moderation context does not match this board" },
          { status: 400 },
        );
      }
    }

    console.error("[MODERATION_BOARD_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
