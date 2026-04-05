import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildDateCursor,
  getSafeCursorLimit,
  parseDateCursor,
} from "@/lib/platform-moderation";
import {
  moderationProfileWithUserIdSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

// Get all banned users
export async function GET(req: Request) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));

    const where = {
      banned: true,
      bannedAt: { not: null },
      ...(cursor
        ? {
            OR: [
              { bannedAt: { lt: cursor.createdAt } },
              {
                AND: [{ bannedAt: cursor.createdAt }, { id: { lt: cursor.id } }],
              },
            ],
          }
        : {}),
    };

    const [bannedUsers, total] = await Promise.all([
      db.profile.findMany({
        where,
        select: {
          ...moderationProfileWithUserIdSelect,
          banned: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
          _count: {
            select: {
              strikes: true,
              reportsAgainst: true,
            },
          },
        },
        orderBy: [{ bannedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      db.profile.count({
        where: {
          banned: true,
          bannedAt: { not: null },
        },
      }),
    ]);

    const hasMore = bannedUsers.length > limit;
    const items = hasMore ? bannedUsers.slice(0, limit) : bannedUsers;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem?.bannedAt
        ? buildDateCursor({
            createdAt: lastItem.bannedAt,
            id: lastItem.id,
          })
        : null;

    const serializedItems = items.map(serializeModerationProfile);

    return NextResponse.json(
      {
        items: serializedItems,
        bannedUsers: serializedItems,
        nextCursor,
        hasMore,
        total,
        pagination: {
          page: 1,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_BANNED_USERS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
