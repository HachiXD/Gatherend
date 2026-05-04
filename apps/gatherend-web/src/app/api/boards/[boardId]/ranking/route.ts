import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function getSafeLimit(limitParam: string | null) {
  const parsed = Number.parseInt(limitParam ?? String(DEFAULT_LIMIT), 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

export async function GET(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { boardId } = await context.params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = getSafeLimit(searchParams.get("limit"));

    if (cursor && !UUID_REGEX.test(cursor)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    const [actor, cursorMember] = await Promise.all([
      db.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { id: true },
      }),
      cursor
        ? db.member.findFirst({
            where: { id: cursor, boardId },
            select: { id: true, level: true, xp: true },
          })
        : Promise.resolve(null),
    ]);

    if (!actor) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (cursor && !cursorMember) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    // For cursor pagination ordered by (level DESC, xp DESC, id ASC),
    // the "after cursor" set is all records ranked worse than the cursor member.
    const whereAfterCursor = cursorMember
      ? {
          boardId,
          OR: [
            { level: { lt: cursorMember.level } },
            { level: cursorMember.level, xp: { lt: cursorMember.xp } },
            {
              level: cursorMember.level,
              xp: cursorMember.xp,
              id: { gt: cursorMember.id },
            },
          ],
        }
      : { boardId };

    const [members, countBeforeCursor] = await Promise.all([
      db.member.findMany({
        where: whereAfterCursor,
        select: {
          id: true,
          profileId: true,
          xp: true,
          level: true,
          profile: {
            select: {
              id: true,
              username: true,
              discriminator: true,
              usernameColor: true,
              profileTags: true,
              badge: true,
              usernameFormat: true,
              avatarAsset: { select: uploadedAssetSummarySelect },
              badgeSticker: {
                select: {
                  id: true,
                  asset: { select: uploadedAssetSummarySelect },
                },
              },
            },
          },
        },
        orderBy: [{ level: "desc" }, { xp: "desc" }, { id: "asc" }],
        take: limit + 1,
      }),
      // Count members ranked strictly above the cursor to compute rank offsets.
      cursorMember
        ? db.member.count({
            where: {
              boardId,
              OR: [
                { level: { gt: cursorMember.level } },
                { level: cursorMember.level, xp: { gt: cursorMember.xp } },
                {
                  level: cursorMember.level,
                  xp: cursorMember.xp,
                  id: { lt: cursorMember.id },
                },
              ],
            },
          })
        : Promise.resolve(0),
    ]);

    const hasMore = members.length > limit;
    const items = hasMore ? members.slice(0, limit) : members;

    // firstRank = rank of the first item in this page.
    // With no cursor: rank starts at 1.
    // With cursor: countBeforeCursor members ranked above cursor + cursor itself (1) + 1 offset.
    const firstRank = cursorMember ? countBeforeCursor + 2 : 1;

    const serializedItems = items.map((member, index) => ({
      ...member,
      rank: firstRank + index,
      profile: {
        ...member.profile,
        avatarAsset: serializeUploadedAsset(member.profile.avatarAsset),
        badgeSticker: member.profile.badgeSticker
          ? {
              id: member.profile.badgeSticker.id,
              asset: serializeUploadedAsset(member.profile.badgeSticker.asset),
            }
          : null,
      },
    }));

    const lastItem =
      serializedItems.length > 0
        ? serializedItems[serializedItems.length - 1]
        : null;

    return NextResponse.json({
      items: serializedItems,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    });
  } catch (error) {
    console.error("[BOARD_RANKING_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
