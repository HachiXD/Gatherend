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

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "pending";

    // Build status filter
    let statusFilter: ReportStatus[] = [];
    if (filter === "pending") {
      statusFilter = ["PENDING", "REVIEWING"];
    } else if (filter === "resolved") {
      statusFilter = ["ACTION_TAKEN", "DISMISSED"];
    }
    // "all" = no filter

    const reports = await db.report.findMany({
      where:
        statusFilter.length > 0 ? { status: { in: statusFilter } } : undefined,
      include: {
        reporter: {
          select: moderationProfileSelect,
        },
        targetOwner: {
          select: moderationProfileWithUserIdSelect,
        },
      },
      orderBy: [
        { priority: "asc" }, // urgent first
        { createdAt: "desc" },
      ],
      take: 100,
    });

    // Transform for frontend
    const transformedReports = reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      category: report.category,
      status: report.status,
      priority: report.priority,
      description: report.description,
      createdAt: report.createdAt.toISOString(),
      reporter: serializeModerationProfile(report.reporter),
      targetOwner: serializeModerationProfile(report.targetOwner),
      snapshot: report.snapshot as Record<string, unknown>,
    }));

    return NextResponse.json({ reports: transformedReports });
  } catch (error) {
    console.error("[MODERATION_REPORTS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
