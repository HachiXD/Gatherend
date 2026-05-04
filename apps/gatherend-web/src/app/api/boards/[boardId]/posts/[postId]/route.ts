import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { boardId, postId } = await params;

    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }
    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const boardExists = await db.board.findFirst({
      where: { id: boardId, members: { some: { profileId: profile.id } } },
      select: { id: true },
    });

    if (!boardExists) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const post = await db.communityPost.findFirst({
      where: { id: postId, boardId, deleted: false },
      select: {
        id: true,
        title: true,
        content: true,
        commentCount: true,
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
                  select: { id: true, asset: { select: uploadedAssetSummarySelect } },
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
                author: { select: { id: true, username: true, discriminator: true } },
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title ?? null,
        content: post.content,
        imageAsset: serializeUploadedAsset(post.imageAsset),
        commentCount: post.commentCount,
        latestComments: [...post.comments].reverse().map(serializeCommentPreview),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        pinnedAt: post.pinnedAt?.toISOString() ?? null,
        lockedAt: post.lockedAt?.toISOString() ?? null,
        author: serializeProfileSummary(post.author),
      },
    });
  } catch (error) {
    console.error("[BOARD_POST_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
