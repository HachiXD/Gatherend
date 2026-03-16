import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ReportStatus } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileSelect,
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

export async function GET() {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    // Get counts for different report statuses
    const [
      pendingReports,
      reviewingReports,
      actionTakenReports,
      dismissedReports,
      totalReports,
      totalStrikes,
      activeStrikes,
      bannedUsers,
      reportsToday,
      reportsThisWeek,
      categoryBreakdown,
      typeBreakdown,
    ] = await Promise.all([
      db.report.count({ where: { status: ReportStatus.PENDING } }),
      db.report.count({ where: { status: ReportStatus.REVIEWING } }),
      db.report.count({ where: { status: ReportStatus.ACTION_TAKEN } }),
      db.report.count({ where: { status: ReportStatus.DISMISSED } }),
      db.report.count(),
      db.strike.count(),
      db.strike.count({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      db.profile.count({ where: { banned: true } }),
      db.report.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      db.report.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.report.groupBy({
        by: ["category"],
        _count: { category: true },
      }),
      db.report.groupBy({
        by: ["targetType"],
        _count: { targetType: true },
      }),
    ]);

    // Get recent activity
    const recentReports = await db.report.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        targetType: true,
        category: true,
        status: true,
        createdAt: true,
        reporter: {
          select: {
            username: true,
            discriminator: true,
          },
        },
      },
    });

    // Get top reporters (users who file the most reports)
    const topReporters = await db.profile.findMany({
      where: {
        OR: [{ validReports: { gt: 0 } }, { falseReports: { gt: 0 } }],
      },
      select: {
        ...moderationProfileSelect,
        validReports: true,
        falseReports: true,
        reportAccuracy: true,
      },
      orderBy: [{ validReports: "desc" }],
      take: 10,
    });

    // Get most reported users
    const mostReportedUsers = await db.profile.findMany({
      where: {
        reportsAgainst: {
          some: {},
        },
      },
      select: {
        ...moderationProfileWithUserIdSelect,
        banned: true,
        _count: {
          select: {
            reportsAgainst: true,
            strikes: true,
          },
        },
      },
      orderBy: {
        reportsAgainst: {
          _count: "desc",
        },
      },
      take: 10,
    });

    return NextResponse.json({
      overview: {
        pendingReports,
        reviewingReports,
        actionTakenReports,
        dismissedReports,
        totalReports,
        totalStrikes,
        activeStrikes,
        bannedUsers,
        reportsToday,
        reportsThisWeek,
      },
      breakdown: {
        byCategory: categoryBreakdown.map((c) => ({
          category: c.category,
          count: c._count.category,
        })),
        byType: typeBreakdown.map((t) => ({
          type: t.targetType,
          count: t._count.targetType,
        })),
      },
      recentReports,
      topReporters: topReporters.map(serializeModerationProfile),
      mostReportedUsers: mostReportedUsers.map(serializeModerationProfile),
    });
  } catch (error) {
    console.error("[MODERATION_STATS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
