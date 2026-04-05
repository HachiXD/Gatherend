import { NextResponse } from "next/server";
import { PlatformWarningStatus, StrikeSourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";
import {
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";
import { UUID_REGEX } from "@/lib/platform-moderation";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  const { userId: profileId } = await params;

  if (!profileId || !UUID_REGEX.test(profileId)) {
    return NextResponse.json(
      { error: "Invalid profile ID format" },
      { status: 400 },
    );
  }

  try {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: {
        ...moderationProfileWithUserIdSelect,
        banned: true,
        bannedAt: true,
        banReason: true,
        validReports: true,
        falseReports: true,
        reportAccuracy: true,
        reputationScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [
      reportsFiled,
      reportsAgainst,
      totalReportsFiled,
      totalReportsAgainst,
      strikes,
      totalStrikes,
      activeStrikes,
      directStrikes,
      warningEscalationStrikes,
      totalPlatformActions,
      boardsOwned,
      members,
      warningCounts,
      recentWarnings,
      recentPlatformActions,
    ] = await Promise.all([
      db.report.findMany({
        where: { reporterId: profile.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          category: true,
          status: true,
          createdAt: true,
        },
      }),
      db.report.findMany({
        where: { targetOwnerId: profile.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        include: {
          reporter: {
            select: moderationProfileSelect,
          },
        },
      }),
      db.report.count({
        where: { reporterId: profile.id },
      }),
      db.report.count({
        where: { targetOwnerId: profile.id },
      }),
      db.strike.findMany({
        where: { profileId: profile.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
      db.strike.count({
        where: { profileId: profile.id },
      }),
      db.strike.count({
        where: {
          profileId: profile.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      db.strike.count({
        where: {
          profileId: profile.id,
          sourceType: StrikeSourceType.DIRECT,
        },
      }),
      db.strike.count({
        where: {
          profileId: profile.id,
          sourceType: StrikeSourceType.WARNING_ESCALATION,
        },
      }),
      db.platformModerationAction.count({
        where: { profileId: profile.id },
      }),
      db.board.findMany({
        where: { profileId: profile.id },
        select: {
          id: true,
          name: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
          reportCount: true,
          hiddenFromFeed: true,
          riskLevel: true,
          createdAt: true,
          _count: {
            select: { members: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.member.findMany({
        where: { profileId: profile.id },
        select: { id: true },
      }),
      db.platformWarning.groupBy({
        by: ["status"],
        where: { profileId: profile.id },
        _count: { _all: true },
      }),
      db.platformWarning.findMany({
        where: { profileId: profile.id },
        include: {
          issuedBy: {
            select: moderationProfileSelect,
          },
          removedBy: {
            select: moderationProfileSelect,
          },
          report: {
            select: {
              id: true,
              category: true,
              targetType: true,
              status: true,
              createdAt: true,
            },
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
        where: { profileId: profile.id },
        include: {
          issuedBy: {
            select: moderationProfileSelect,
          },
          report: {
            select: {
              id: true,
              category: true,
              targetType: true,
              status: true,
              createdAt: true,
            },
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
          strike: {
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    ]);

    const memberIds = members.map((member) => member.id);
    const messageCount =
      memberIds.length > 0
        ? await db.message.count({
            where: { memberId: { in: memberIds } },
          })
        : 0;

    const warningStats = {
      active:
        warningCounts.find((entry) => entry.status === PlatformWarningStatus.ACTIVE)
          ?._count._all ?? 0,
      promoted:
        warningCounts.find(
          (entry) => entry.status === PlatformWarningStatus.PROMOTED,
        )?._count._all ?? 0,
      removed:
        warningCounts.find((entry) => entry.status === PlatformWarningStatus.REMOVED)
          ?._count._all ?? 0,
    };

    return NextResponse.json({
      profile: serializeModerationProfile(profile),
      recentWarnings: recentWarnings.map((warning) => ({
        ...warning,
        issuedBy: serializeModerationProfile(warning.issuedBy),
        removedBy: serializeModerationProfile(warning.removedBy),
        createdAt: warning.createdAt.toISOString(),
        updatedAt: warning.updatedAt.toISOString(),
        removedAt: warning.removedAt?.toISOString() ?? null,
        report: warning.report
          ? {
              ...warning.report,
              createdAt: warning.report.createdAt.toISOString(),
            }
          : null,
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
        report: action.report
          ? {
              ...action.report,
              createdAt: action.report.createdAt.toISOString(),
            }
          : null,
        warning: action.warning
          ? {
              ...action.warning,
              createdAt: action.warning.createdAt.toISOString(),
              updatedAt: action.warning.updatedAt.toISOString(),
              removedAt: action.warning.removedAt?.toISOString() ?? null,
            }
          : null,
        strike: action.strike
          ? {
              ...action.strike,
              createdAt: action.strike.createdAt.toISOString(),
            }
          : null,
      })),
      reportsFiled: reportsFiled.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
      })),
      reportsAgainst: reportsAgainst.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        reporter: serializeModerationProfile(report.reporter),
      })),
      strikes: strikes.map((strike) => ({
        ...strike,
        createdAt: strike.createdAt.toISOString(),
        appealedAt: strike.appealedAt?.toISOString() ?? null,
        appealResolvedAt: strike.appealResolvedAt?.toISOString() ?? null,
        expiresAt: strike.expiresAt?.toISOString() ?? null,
      })),
      boardsOwned: boardsOwned.map((board) => ({
        ...board,
        imageAsset: serializeUploadedAsset(board.imageAsset),
        createdAt: board.createdAt.toISOString(),
      })),
      stats: {
        warningStats,
        strikeStats: {
          active: activeStrikes,
          total: totalStrikes,
          direct: directStrikes,
          warningEscalation: warningEscalationStrikes,
        },
        totalReportsFiled,
        totalReportsAgainst,
        totalStrikes,
        activeStrikes,
        totalPlatformActions,
        boardsOwned: boardsOwned.length,
        totalMessages: messageCount,
        accountAge: Math.floor(
          (Date.now() - new Date(profile.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      },
    });
  } catch (error) {
    console.error("[MODERATION_USER_LOOKUP]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
