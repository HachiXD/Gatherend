import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOP_POSTS_COUNT = 5;
const TOP_CHANNELS_COUNT = 3;
const SNIPPET_MAX_CHARS = 150;

function makeSnippet(content: string): string {
  if (content.length <= SNIPPET_MAX_CHARS) return content;
  const cut = content.lastIndexOf(" ", SNIPPET_MAX_CHARS);
  return (
    (cut > 0 ? content.slice(0, cut) : content.slice(0, SNIPPET_MAX_CHARS)) +
    "…"
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const board = await db.board.findFirst({
      where: {
        id: boardId,
        members: { some: { profileId: profile.id } },
      },
      select: { id: true },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const [rawPosts, rawChannels] = await Promise.all([
      db.communityPost.findMany({
        where: {
          boardId,
          deleted: false,
          createdAt: { gte: since },
        },
        orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
        take: TOP_POSTS_COUNT,
        select: {
          id: true,
          title: true,
          content: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          updatedAt: true,
          pinnedAt: true,
          lockedAt: true,
          imageAsset: { select: uploadedAssetSummarySelect },
          author: {
            select: {
              id: true,
              username: true,
              discriminator: true,
              badge: true,
              usernameColor: true,
              usernameFormat: true,
              profileTags: true,
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
      }),

      db.channel.findMany({
        where: { boardId },
        orderBy: { channelMembers: { _count: "desc" } },
        take: TOP_CHANNELS_COUNT,
        select: {
          id: true,
          name: true,
          type: true,
          _count: { select: { channelMembers: true } },
          imageAsset: { select: uploadedAssetSummarySelect },
        },
      }),
    ]);

    const postIds = rawPosts.map((p) => p.id);
    const likedPosts = await db.communityPostLike.findMany({
      where: { profileId: profile.id, postId: { in: postIds } },
      select: { postId: true },
    });
    const likedPostSet = new Set(likedPosts.map((l) => l.postId));

    const topPosts = rawPosts.map((post) => ({
      id: post.id,
      title: post.title,
      contentSnippet: makeSnippet(post.content),
      imageAsset: serializeUploadedAsset(post.imageAsset),
      likeCount: post.likeCount,
      isLikedByCurrentUser: likedPostSet.has(post.id),
      commentCount: post.commentCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      pinnedAt: post.pinnedAt?.toISOString() ?? null,
      lockedAt: post.lockedAt?.toISOString() ?? null,
      author: serializeProfileSummary(post.author),
    }));

    const topChannels = rawChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      memberCount: ch._count.channelMembers,
      imageAsset: serializeUploadedAsset(ch.imageAsset),
    }));

    return NextResponse.json({ topPosts, topChannels });
  } catch (error) {
    console.error("[BOARD_FEATURED_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
