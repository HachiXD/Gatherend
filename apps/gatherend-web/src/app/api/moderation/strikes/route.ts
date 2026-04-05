import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildDateCursor,
  getSafeCursorLimit,
  parseDateCursor,
  STRIKE_FILTERS,
} from "@/lib/platform-moderation";
import {
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

// Get all strikes with optional filters
export async function GET(req: Request) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "active";

    if (!STRIKE_FILTERS.includes(filter as (typeof STRIKE_FILTERS)[number])) {
      return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    }

    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));

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

    const strikes = await db.strike.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
                },
              ],
            }
          : {}),
      },
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = strikes.length > limit;
    const items = hasMore ? strikes.slice(0, limit) : strikes;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? buildDateCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id,
          })
        : null;

    const serializedItems = items.map((strike) => ({
      ...strike,
      profile: serializeModerationProfile(strike.profile),
      createdAt: strike.createdAt.toISOString(),
      appealedAt: strike.appealedAt?.toISOString() ?? null,
      appealResolvedAt: strike.appealResolvedAt?.toISOString() ?? null,
      expiresAt: strike.expiresAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      items: serializedItems,
      strikes: serializedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_STRIKES]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
