import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildDateCursor,
  getSafeCursorLimit,
  parseDateCursor,
  UUID_REGEX,
} from "@/lib/platform-moderation";

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
    const { searchParams } = new URL(req.url);
    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));

    const strikes = await db.strike.findMany({
      where: {
        profileId,
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
        originReport: {
          select: {
            id: true,
            category: true,
            targetType: true,
            status: true,
            createdAt: true,
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

    return NextResponse.json({
      items: items.map((strike) => ({
        ...strike,
        createdAt: strike.createdAt.toISOString(),
        appealedAt: strike.appealedAt?.toISOString() ?? null,
        appealResolvedAt: strike.appealResolvedAt?.toISOString() ?? null,
        expiresAt: strike.expiresAt?.toISOString() ?? null,
        originReport: strike.originReport
          ? {
              ...strike.originReport,
              createdAt: strike.originReport.createdAt.toISOString(),
            }
          : null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[MODERATION_USER_STRIKES]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
