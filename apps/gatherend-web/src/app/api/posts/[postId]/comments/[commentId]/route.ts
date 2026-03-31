import { AssetContext, AssetVisibility, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeProfileSummary,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const MAX_CONTENT_LENGTH = 2000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const commentSelect = {
  id: true,
  postId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deleted: true,
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
} as const;

function serializeComment(comment: {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  imageAsset: {
    id: string;
    key: string;
    visibility: AssetVisibility;
    context: AssetContext;
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
    usernameColor: Prisma.JsonValue | null;
    usernameFormat: Prisma.JsonValue | null;
    profileTags: string[];
    avatarAsset: {
      id: string;
      key: string;
      visibility: AssetVisibility;
      context: AssetContext;
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
        visibility: AssetVisibility;
        context: AssetContext;
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { postId, commentId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    if (!commentId || !UUID_REGEX.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    let body: {
      content?: unknown;
      imageAssetId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { content, imageAssetId } = body;

    if (content === undefined && imageAssetId === undefined) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 },
      );
    }

    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (content !== undefined && trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
        },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null | undefined = undefined;
    if (imageAssetId !== undefined) {
      if (imageAssetId === null || imageAssetId === "") {
        resolvedImageAssetId = null;
      } else if (
        typeof imageAssetId !== "string" ||
        !UUID_REGEX.test(imageAssetId)
      ) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const imageAsset = await findOwnedUploadedAsset(
          imageAssetId,
          profile.id,
          AssetContext.COMMUNITY_POST_COMMENT_IMAGE,
          AssetVisibility.PUBLIC,
        );

        if (!imageAsset) {
          return NextResponse.json(
            { error: "Community post comment image asset not found" },
            { status: 400 },
          );
        }

        resolvedImageAssetId = imageAsset.id;
      }
    }

    if (content !== undefined && trimmedContent.length > 0) {
      const moderationResult = moderateDescription(trimmedContent);
      if (!moderationResult.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              moderationResult.message ||
              "Comment content contains prohibited content",
            reason: moderationResult.reason,
          },
          { status: 400 },
        );
      }
    }

    const updatedComment = await db.$transaction(async (tx) => {
      const existingComment = await tx.communityPostComment.findFirst({
        where: {
          id: commentId,
          postId,
        },
        select: {
          id: true,
          content: true,
          deleted: true,
          authorProfileId: true,
          imageAssetId: true,
        },
      });

      if (!existingComment || existingComment.deleted) {
        throw new Error("COMMENT_NOT_FOUND");
      }

      if (existingComment.authorProfileId !== profile.id) {
        throw new Error("FORBIDDEN");
      }

      const nextContent =
        content !== undefined ? trimmedContent : existingComment.content;
      const nextImageAssetId =
        resolvedImageAssetId !== undefined
          ? resolvedImageAssetId
          : existingComment.imageAssetId;

      if (!nextContent && !nextImageAssetId) {
        throw new Error("COMMENT_EMPTY");
      }

      return tx.communityPostComment.update({
        where: { id: commentId },
        data: {
          ...(content !== undefined && { content: trimmedContent }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
        },
        select: commentSelect,
      });
    });

    return NextResponse.json(serializeComment(updatedComment));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the comment creator can edit this comment" },
          { status: 403 },
        );
      }

      if (error.message === "COMMENT_EMPTY") {
        return NextResponse.json(
          { error: "Comment must include content or an image" },
          { status: 400 },
        );
      }
    }

    console.error("[POST_COMMENT_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { postId, commentId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    if (!commentId || !UUID_REGEX.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    await db.$transaction(async (tx) => {
      const comment = await tx.communityPostComment.findFirst({
        where: {
          id: commentId,
          postId,
        },
        select: {
          id: true,
          deleted: true,
          authorProfileId: true,
          post: {
            select: {
              board: {
                select: {
                  profileId: true,
                  members: {
                    where: {
                      profileId: profile.id,
                      role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
                    },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!comment || comment.deleted) {
        throw new Error("COMMENT_NOT_FOUND");
      }

      const isAuthor = comment.authorProfileId === profile.id;
      const isBoardOwner = comment.post.board?.profileId === profile.id;
      const isBoardModerator = (comment.post.board?.members.length ?? 0) > 0;

      if (!isAuthor && !isBoardOwner && !isBoardModerator) {
        throw new Error("FORBIDDEN");
      }

      await tx.communityPostComment.update({
        where: { id: commentId },
        data: {
          deleted: true,
          imageAssetId: null,
          content: "",
        },
      });

      await tx.communityPost.update({
        where: { id: postId },
        data: {
          commentCount: {
            decrement: 1,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      deletedCommentId: commentId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            error:
              "Only the comment creator, community owner, or community helper can delete this comment",
          },
          { status: 403 },
        );
      }
    }

    console.error("[POST_COMMENT_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
