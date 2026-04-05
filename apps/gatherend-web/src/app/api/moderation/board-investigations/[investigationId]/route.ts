import { MemberRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import { loadScopedReportTargetContext } from "@/lib/moderation-report-context";
import { serializeUploadedAsset, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { investigationId } = await params;

    if (
      !investigationId ||
      typeof investigationId !== "string" ||
      investigationId.length > 191
    ) {
      return NextResponse.json(
        { error: "Invalid investigation ID" },
        { status: 400 },
      );
    }

    const investigation = await db.boardInvestigation.findUnique({
      where: { id: investigationId },
      include: {
        openedBy: {
          select: moderationProfileSelect,
        },
        closedBy: {
          select: moderationProfileSelect,
        },
        sourceReport: {
          include: {
            reporter: {
              select: moderationProfileSelect,
            },
            targetOwner: {
              select: moderationProfileSelect,
            },
          },
        },
        board: {
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
                targetOwner: {
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
        },
      },
    });

    if (!investigation) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }

    const scopedContext = await loadScopedReportTargetContext({
      targetType: investigation.sourceReport.targetType,
      targetId: investigation.sourceReport.targetId,
    });

    return NextResponse.json({
      id: investigation.id,
      boardId: investigation.boardId,
      status: investigation.status,
      notes: investigation.notes,
      boardSnapshot: investigation.boardSnapshot,
      createdAt: investigation.createdAt.toISOString(),
      updatedAt: investigation.updatedAt.toISOString(),
      closedAt: investigation.closedAt?.toISOString() ?? null,
      openedBy: serializeModerationProfile(investigation.openedBy),
      closedBy: serializeModerationProfile(investigation.closedBy),
      sourceReport: {
        id: investigation.sourceReport.id,
        targetType: investigation.sourceReport.targetType,
        targetId: investigation.sourceReport.targetId,
        boardId: investigation.sourceReport.boardId,
        channelId: investigation.sourceReport.channelId,
        category: investigation.sourceReport.category,
        status: investigation.sourceReport.status,
        priority: investigation.sourceReport.priority,
        description: investigation.sourceReport.description,
        snapshot: investigation.sourceReport.snapshot as Record<string, unknown>,
        createdAt: investigation.sourceReport.createdAt.toISOString(),
        reporter: serializeModerationProfile(investigation.sourceReport.reporter),
        targetOwner: serializeModerationProfile(
          investigation.sourceReport.targetOwner,
        ),
      },
      board: investigation.board
        ? {
            id: investigation.board.id,
            name: investigation.board.name,
            description: investigation.board.description,
            isPrivate: investigation.board.isPrivate,
            inviteEnabled: investigation.board.inviteEnabled,
            hiddenFromFeed: investigation.board.hiddenFromFeed,
            reportCount: investigation.board.reportCount,
            memberCount: investigation.board.memberCount,
            riskPoints: investigation.board.riskPoints,
            riskLevel: investigation.board.riskLevel,
            createdAt: investigation.board.createdAt.toISOString(),
            updatedAt: investigation.board.updatedAt.toISOString(),
            imageAsset: serializeUploadedAsset(investigation.board.imageAsset),
            owner: serializeModerationProfile(investigation.board.profile),
            staff: investigation.board.members.map((member) => ({
              id: member.id,
              role: member.role,
              createdAt: member.createdAt.toISOString(),
              profile: serializeModerationProfile(member.profile),
            })),
            recentReports: investigation.board.reports.map((report) => ({
              ...report,
              createdAt: report.createdAt.toISOString(),
              reporter: serializeModerationProfile(report.reporter),
              targetOwner: serializeModerationProfile(report.targetOwner),
            })),
            recentRiskEvents: investigation.board.riskEvents.map((event) => ({
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
            recentPlatformBoardActions: investigation.board.platformBoardActions.map(
              (action) => ({
                ...action,
                createdAt: action.createdAt.toISOString(),
                issuedBy: serializeModerationProfile(action.issuedBy),
                sourceReport: action.sourceReport
                  ? {
                      ...action.sourceReport,
                      createdAt: action.sourceReport.createdAt.toISOString(),
                    }
                  : null,
              }),
            ),
          }
        : null,
      ...scopedContext,
    });
  } catch (error) {
    console.error("[MODERATION_BOARD_INVESTIGATION_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
