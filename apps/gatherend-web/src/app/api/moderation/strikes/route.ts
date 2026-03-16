import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

// Get all strikes with optional filters
export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "active";

    // Validate and sanitize pagination params
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = Number.isNaN(limitParam)
      ? 20
      : Math.min(Math.max(limitParam, 1), 100);

    let where = {};

    if (filter === "active") {
      where = {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      };
    } else if (filter === "expired") {
      where = {
        expiresAt: { lte: new Date() },
      };
    }

    const [strikes, total] = await Promise.all([
      db.strike.findMany({
        where,
        include: {
          profile: {
            select: {
              ...moderationProfileWithUserIdSelect,
              banned: true,
            },
          },
          originReport: {
            select: {
              id: true,
              targetType: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.strike.count({ where }),
    ]);

    return NextResponse.json({
      strikes: strikes.map((strike) => ({
        ...strike,
        profile: serializeModerationProfile(strike.profile),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[MODERATION_STRIKES]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
