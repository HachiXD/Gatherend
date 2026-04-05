import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  buildDateCursor,
  getSafeCursorLimit,
  parseDateCursor,
  UUID_REGEX,
} from "@/lib/platform-moderation";
import {
  moderationProfileSelect,
  serializeModerationProfile,
} from "@/lib/moderation-serialization";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderationRead);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const boardId = params.boardId;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const actor = await db.member.findFirst({
      where: { boardId, profileId: profile.id },
      select: { role: true },
    });

    if (!actor) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (actor.role !== MemberRole.OWNER && actor.role !== MemberRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = parseDateCursor(searchParams.get("cursor"));
    const limit = getSafeCursorLimit(searchParams.get("limit"));
    const profileId = searchParams.get("profileId");

    if (profileId && !UUID_REGEX.test(profileId)) {
      return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    const actions = await db.boardModerationAction.findMany({
      where: {
        boardId,
        ...(profileId ? { profileId } : {}),
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
          select: moderationProfileSelect,
        },
        issuedBy: {
          select: moderationProfileSelect,
        },
        warning: {
          select: {
            id: true,
            status: true,
            removedAt: true,
            promotedToBanId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        ban: {
          select: {
            id: true,
            sourceType: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = actions.length > limit;
    const items = hasMore ? actions.slice(0, limit) : actions;
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? buildDateCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id,
          })
        : null;

    const serializedItems = items.map((action) => ({
      ...action,
      profile: serializeModerationProfile(action.profile),
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
      ban: action.ban
        ? {
            ...action.ban,
            createdAt: action.ban.createdAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({
      items: serializedItems,
      actions: serializedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    console.error("[BOARD_MODERATION_ACTIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
