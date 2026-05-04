import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 10;
const MAX_LIMIT = 50;
const MAX_CURSOR_LENGTH = 128;
const SNIPPET_MAX_CHARS = 200;

interface CommunityPostPreviewItem {
  id: string;
  title: string | null;
  contentSnippet: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  commentCount: number;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: ReturnType<typeof serializeProfileSummary>;
}

interface BoardMetadata {
  id: string;
  name: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  memberCount: number;
  recentPostCount7d: number;
}

interface CommunityPostFeedItem {
  id: string;
  title: string | null;
  content: string;
  imageAsset: ReturnType<typeof serializeUploadedAsset>;
  commentCount: number;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  latestComments: Array<{
    id: string;
    postId: string;
    content: string;
    deleted: boolean;
    imageAsset: ReturnType<typeof serializeUploadedAsset>;
    createdAt: string;
    updatedAt: string;
    author: ReturnType<typeof serializeProfileSummary>;
    replyToCommentId: string | null;
    replyToComment: {
      id: string;
      content: string;
      deleted: boolean;
      createdAt: string;
      author: {
        id: string;
        username: string;
        discriminator: string | null;
      };
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: ReturnType<typeof serializeProfileSummary>;
}

function serializeCommentPreview(comment: {
  id: string;
  postId: string;
  content: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  imageAsset: {
    id: string;
    key: string;
    visibility: import("@prisma/client").AssetVisibility;
    context: import("@prisma/client").AssetContext;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
    dominantColor: string | null;
  } | null;
  author: {
    id: string;
    username: string;
    discriminator: string | null;
    badge: string | null;
    usernameColor: import("@prisma/client").Prisma.JsonValue | null;
    usernameFormat: import("@prisma/client").Prisma.JsonValue | null;
    profileTags: string[];
    avatarAsset: {
      id: string;
      key: string;
      visibility: import("@prisma/client").AssetVisibility;
      context: import("@prisma/client").AssetContext;
      mimeType: string;
      sizeBytes: number | null;
      width: number | null;
      height: number | null;
      originalName: string | null;
      dominantColor: string | null;
    } | null;
    badgeSticker: {
      id: string;
      asset: {
        id: string;
        key: string;
        visibility: import("@prisma/client").AssetVisibility;
        context: import("@prisma/client").AssetContext;
        mimeType: string;
        sizeBytes: number | null;
        width: number | null;
        height: number | null;
        originalName: string | null;
        dominantColor: string | null;
      } | null;
    } | null;
  };
  replyToCommentId: string | null;
  replyToComment: {
    id: string;
    content: string;
    deleted: boolean;
    createdAt: Date;
    author: {
      id: string;
      username: string;
      discriminator: string | null;
    };
  } | null;
}) {
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    deleted: comment.deleted,
    imageAsset: serializeUploadedAsset(comment.imageAsset),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: serializeProfileSummary(comment.author),
    replyToCommentId: comment.replyToCommentId,
    replyToComment: comment.replyToComment
      ? {
          id: comment.replyToComment.id,
          content: comment.replyToComment.content,
          deleted: comment.replyToComment.deleted,
          createdAt: comment.replyToComment.createdAt.toISOString(),
          author: comment.replyToComment.author,
        }
      : null,
  };
}

function toSnippet(content: string): string {
  if (content.length <= SNIPPET_MAX_CHARS) return content;
  const cut = content.lastIndexOf(" ", SNIPPET_MAX_CHARS);
  return (cut > 0 ? content.slice(0, cut) : content.slice(0, SNIPPET_MAX_CHARS)) + "…";
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
    const { searchParams } = new URL(req.url);

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json(
        { error: "Invalid board ID" },
        { status: 400 },
      );
    }

    const isPreview = searchParams.get("preview") === "true";
    const cursorParam = searchParams.get("cursor");
    const limitParam = parseInt(
      searchParams.get("limit") || String(PAGE_SIZE),
      10,
    );
    const limit = Math.min(
      Number.isNaN(limitParam) ? PAGE_SIZE : limitParam,
      MAX_LIMIT,
    );
    const isFirstPage = !cursorParam;

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursorParam) {
      if (cursorParam.length > MAX_CURSOR_LENGTH) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const [createdAtStr, id] = cursorParam.split("|");

      if (!createdAtStr || !id || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      const parsedCreatedAt = new Date(createdAtStr);
      if (Number.isNaN(parsedCreatedAt.getTime())) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      cursorCreatedAt = parsedCreatedAt;
      cursorId = id;
    }

    let boardMetadata: BoardMetadata | null = null;

    if (isFirstPage) {
      const board = await db.board.findFirst({
        where: {
          id: boardId,
          members: { some: { profileId: profile.id } },
        },
        select: {
          id: true,
          name: true,
          memberCount: true,
          recentPostCount7d: true,
          imageAsset: {
            select: uploadedAssetSummarySelect,
          },
        },
      });

      if (!board) {
        return NextResponse.json(
          { error: "Board not found" },
          { status: 404 },
        );
      }

      boardMetadata = {
        id: board.id,
        name: board.name,
        imageAsset: serializeUploadedAsset(board.imageAsset),
        memberCount: board.memberCount,
        recentPostCount7d: board.recentPostCount7d,
      };
    } else {
      const boardExists = await db.board.findFirst({
        where: {
          id: boardId,
          members: { some: { profileId: profile.id } },
        },
        select: { id: true },
      });

      if (!boardExists) {
        return NextResponse.json(
          { error: "Board not found" },
          { status: 404 },
        );
      }
    }

    if (isPreview) {
      const previewPosts = await db.communityPost.findMany({
        where: {
          boardId,
          deleted: false,
          ...(cursorCreatedAt && cursorId
            ? {
                OR: [
                  { createdAt: { lt: cursorCreatedAt } },
                  { AND: [{ createdAt: cursorCreatedAt }, { id: { lt: cursorId } }] },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: {
          id: true,
          title: true,
          content: true,
          commentCount: true,
          likeCount: true,
          imageAsset: { select: uploadedAssetSummarySelect },
          createdAt: true,
          updatedAt: true,
          pinnedAt: true,
          lockedAt: true,
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
                select: { id: true, asset: { select: uploadedAssetSummarySelect } },
              },
            },
          },
        },
      });

      const previewHasMore = previewPosts.length > limit;
      const previewItems = previewHasMore ? previewPosts.slice(0, limit) : previewPosts;
      const lastPreviewItem = previewItems.length > 0 ? previewItems[previewItems.length - 1] : null;
      const previewNextCursor =
        previewHasMore && lastPreviewItem
          ? `${lastPreviewItem.createdAt.toISOString()}|${lastPreviewItem.id}`
          : null;

      const previewPostIds = previewItems.map((p) => p.id);
      const previewLikedByUser = await db.communityPostLike.findMany({
        where: { profileId: profile.id, postId: { in: previewPostIds } },
        select: { postId: true },
      });
      const previewLikedSet = new Set(previewLikedByUser.map((l) => l.postId));

      const previewResult: CommunityPostPreviewItem[] = previewItems.map((post) => ({
        id: post.id,
        title: post.title ?? null,
        contentSnippet: toSnippet(post.content),
        imageAsset: serializeUploadedAsset(post.imageAsset),
        commentCount: post.commentCount,
        likeCount: post.likeCount,
        isLikedByCurrentUser: previewLikedSet.has(post.id),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        pinnedAt: post.pinnedAt?.toISOString() ?? null,
        lockedAt: post.lockedAt?.toISOString() ?? null,
        author: serializeProfileSummary(post.author),
      }));

      return NextResponse.json({
        items: previewResult,
        nextCursor: previewNextCursor,
        hasMore: previewHasMore,
        ...(boardMetadata && { board: boardMetadata }),
      });
    }

    const posts = await db.communityPost.findMany({
      where: {
        boardId,
        deleted: false,
        ...(cursorCreatedAt && cursorId
          ? {
              OR: [
                { createdAt: { lt: cursorCreatedAt } },
                {
                  AND: [{ createdAt: cursorCreatedAt }, { id: { lt: cursorId } }],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        content: true,
        commentCount: true,
        likeCount: true,
        imageAsset: {
          select: uploadedAssetSummarySelect,
        },
        createdAt: true,
        updatedAt: true,
        pinnedAt: true,
        lockedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            badge: true,
            usernameColor: true,
            usernameFormat: true,
            profileTags: true,
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
        comments: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true,
            postId: true,
            content: true,
            deleted: true,
            createdAt: true,
            updatedAt: true,
            imageAsset: {
              select: uploadedAssetSummarySelect,
            },
            author: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                badge: true,
                usernameColor: true,
                usernameFormat: true,
                profileTags: true,
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
            replyToCommentId: true,
            replyToComment: {
              select: {
                id: true,
                content: true,
                deleted: true,
                createdAt: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    discriminator: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    const feedPostIds = items.map((p) => p.id);
    const feedLikedByUser = await db.communityPostLike.findMany({
      where: { profileId: profile.id, postId: { in: feedPostIds } },
      select: { postId: true },
    });
    const feedLikedSet = new Set(feedLikedByUser.map((l) => l.postId));

    const result: CommunityPostFeedItem[] = items.map((post) => ({
      id: post.id,
      title: post.title ?? null,
      content: post.content,
      imageAsset: serializeUploadedAsset(post.imageAsset),
      commentCount: post.commentCount,
      likeCount: post.likeCount,
      isLikedByCurrentUser: feedLikedSet.has(post.id),
      latestComments: [...post.comments]
        .reverse()
        .map(serializeCommentPreview),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      pinnedAt: post.pinnedAt?.toISOString() ?? null,
      lockedAt: post.lockedAt?.toISOString() ?? null,
      author: serializeProfileSummary(post.author),
    }));

    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.createdAt.toISOString()}|${lastItem.id}`
        : null;

    return NextResponse.json({
      items: result,
      nextCursor,
      hasMore,
      ...(boardMetadata && { board: boardMetadata }),
    });
  } catch (error) {
    console.error("[BOARD_POSTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
