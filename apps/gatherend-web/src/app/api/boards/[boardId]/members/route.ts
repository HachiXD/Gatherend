import { BoardWarningStatus } from "@prisma/client";
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!actor) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (cursor && !cursorMember) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    const members = await db.member.findMany({
      where: { boardId },
      select: {
        id: true,
        role: true,
        profileId: true,
        boardId: true,
        xp: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            usernameColor: true,
            profileTags: true,
            badge: true,
            usernameFormat: true,
            avatarAsset: {
              select: uploadedAssetSummarySelect,
            },
            badgeSticker: {
              select: {
                id: true,
                asset: {
                  select: uploadedAssetSummarySelect,
                },
              },
            },
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { profile: { username: "asc" } },
        { profile: { discriminator: "asc" } },
        { id: "asc" },
      ],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
    });

    const hasMore = members.length > limit;
    const items = hasMore ? members.slice(0, limit) : members;
    const memberProfileIds = items.map((member) => member.profileId);

    const [activeWarnings, activeWarningCounts] =
      memberProfileIds.length > 0
        ? await Promise.all([
            db.boardWarning.findMany({
              where: {
                boardId,
                status: BoardWarningStatus.ACTIVE,
                profileId: { in: memberProfileIds },
              },
              select: {
                id: true,
                profileId: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }),
            db.boardWarning.groupBy({
              by: ["profileId"],
              where: {
                boardId,
                status: BoardWarningStatus.ACTIVE,
                profileId: { in: memberProfileIds },
              },
              _count: { _all: true },
            }),
          ])
        : [[], []];

    const activeWarningCountByProfileId = new Map(
      activeWarningCounts.map((warningCount) => [
        warningCount.profileId,
        warningCount._count._all,
      ]),
    );
    const latestActiveWarningIdByProfileId = new Map<string, string>();

    for (const warning of activeWarnings) {
      if (!latestActiveWarningIdByProfileId.has(warning.profileId)) {
        latestActiveWarningIdByProfileId.set(warning.profileId, warning.id);
      }
    }

    const serializedItems = items.map((member) => ({
      ...member,
      activeWarningCount:
        activeWarningCountByProfileId.get(member.profileId) ?? 0,
      latestActiveWarningId:
        latestActiveWarningIdByProfileId.get(member.profileId) ?? null,
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
      members: serializedItems,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    });
  } catch (error) {
    console.error("[BOARD_MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
