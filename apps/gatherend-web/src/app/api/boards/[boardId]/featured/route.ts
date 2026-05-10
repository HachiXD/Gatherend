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

const FEATURED_PAGE_SIZE = 20;
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
  req: Request,
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

    const { searchParams } = new URL(req.url);
    const cursorParam = searchParams.get("cursor");
    const skip = cursorParam ? Math.max(0, parseInt(cursorParam, 10) || 0) : 0;

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

    const rawPosts = await db.communityPost.findMany({
      where: {
        channel: { boardId, type: "FORUM" },
        deleted: false,
      },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      skip,
      take: FEATURED_PAGE_SIZE + 1,
      select: {
        id: true,
        channelId: true,
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
    });

    const hasMore = rawPosts.length > FEATURED_PAGE_SIZE;
    const page = hasMore ? rawPosts.slice(0, FEATURED_PAGE_SIZE) : rawPosts;
    const nextCursor = hasMore ? String(skip + FEATURED_PAGE_SIZE) : null;

    const postIds = page.map((p) => p.id);
    const likedPosts = await db.communityPostLike.findMany({
      where: { profileId: profile.id, postId: { in: postIds } },
      select: { postId: true },
    });
    const likedPostSet = new Set(likedPosts.map((l) => l.postId));

    const items = page.map((post) => ({
      id: post.id,
      channelId: post.channelId,
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

    return NextResponse.json({ items, nextCursor, hasMore });
  } catch (error) {
    console.error("[BOARD_FEATURED_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
