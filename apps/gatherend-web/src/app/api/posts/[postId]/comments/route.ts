import { AssetContext, AssetVisibility, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  awardMemberXp,
  canCreateCommentWithImage,
  canCreateTextComment,
  canSendLinks,
  containsExternalLinks,
  hasMinimumMeaningfulTextLength,
  MEMBER_XP_REWARDS,
} from "@/lib/domain";
import {
  createAccessDeniedResponse,
  getProfileReputationScore,
} from "@/lib/domain-access";
import { expressMemberCache } from "@/lib/redis";
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
  likeCount: true,
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

function serializeComment(
  comment: Awaited<
    ReturnType<typeof db.communityPostComment.findFirstOrThrow>
  > extends never
    ? never
    : {
        id: string;
        postId: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        deleted: boolean;
        likeCount: number;
        imageAsset: typeof db.uploadedAsset extends never
          ? never
          : {
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
      },
  isLikedByCurrentUser: boolean,
) {
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    deleted: comment.deleted,
    likeCount: comment.likeCount,
    isLikedByCurrentUser,
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
  _req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const { postId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const post = await db.communityPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        deleted: true,
        commentCount: true,
      },
    });

    if (!post || post.deleted) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comments = await db.communityPostComment.findMany({
      where: {
        postId,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: commentSelect,
    });

    const commentIds = comments.map((c) => c.id);
    const likedComments = await db.communityPostCommentLike.findMany({
      where: { profileId: profile.id, commentId: { in: commentIds } },
      select: { commentId: true },
    });
    const likedCommentSet = new Set(likedComments.map((l) => l.commentId));

    return NextResponse.json({
      items: comments.map((c) =>
        serializeComment(c, likedCommentSet.has(c.id)),
      ),
      totalCount: post.commentCount,
    });
  } catch (error) {
    console.error("[POST_COMMENTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;
    const reputationScore = getProfileReputationScore(profile.reputationScore);

    const { postId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    let body: {
      content?: unknown;
      imageAssetId?: unknown;
      replyToCommentId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { content, imageAssetId, replyToCommentId } = body;

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 },
      );
    }

    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
        },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null = null;
    if (
      imageAssetId !== undefined &&
      imageAssetId !== null &&
      imageAssetId !== ""
    ) {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      }

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

    let resolvedReplyToCommentId: string | null = null;
    if (
      replyToCommentId !== undefined &&
      replyToCommentId !== null &&
      replyToCommentId !== ""
    ) {
      if (
        typeof replyToCommentId !== "string" ||
        !UUID_REGEX.test(replyToCommentId)
      ) {
        return NextResponse.json(
          { error: "Reply comment ID must be a valid UUID" },
          { status: 400 },
        );
      }

      resolvedReplyToCommentId = replyToCommentId;
    }

    if (!trimmedContent && !resolvedImageAssetId) {
      return NextResponse.json(
        { error: "Comment must include content or an image" },
        { status: 400 },
      );
    }

    if (trimmedContent.length > 0) {
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

    let commentBoardId: string | null = null;

    const createdComment = await db.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          boardId: true,
          deleted: true,
          lockedAt: true,
        },
      });

      if (!post || post.deleted) {
        throw new Error("POST_NOT_FOUND");
      }

      if (post.lockedAt) {
        throw new Error("POST_LOCKED");
      }

      commentBoardId = post.boardId;

      const member = await tx.member.findUnique({
        where: {
          boardId_profileId: {
            boardId: post.boardId,
            profileId: profile.id,
          },
        },
        select: {
          id: true,
          boardId: true,
          profileId: true,
          xp: true,
          level: true,
        },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (resolvedReplyToCommentId) {
        const replyToComment = await tx.communityPostComment.findFirst({
          where: {
            id: resolvedReplyToCommentId,
            postId,
            deleted: false,
          },
          select: { id: true },
        });

        if (!replyToComment) {
          throw new Error("REPLY_COMMENT_NOT_FOUND");
        }
      }

      const accessDecision = resolvedImageAssetId
        ? canCreateCommentWithImage({
            level: member.level,
            reputationScore,
          })
        : canCreateTextComment({
            level: member.level,
            reputationScore,
          });

      if (!accessDecision.allowed) {
        throw new Error(
          JSON.stringify({
            type: "ACCESS_DENIED",
            decision: accessDecision,
          }),
        );
      }

      if (trimmedContent && containsExternalLinks(trimmedContent)) {
        const linksDecision = canSendLinks(reputationScore);
        if (!linksDecision.allowed) {
          throw new Error(
            JSON.stringify({
              type: "ACCESS_DENIED",
              decision: linksDecision,
            }),
          );
        }
      }

      const comment = await tx.communityPostComment.create({
        data: {
          postId,
          authorProfileId: profile.id,
          memberId: member.id,
          content: trimmedContent,
          imageAssetId: resolvedImageAssetId,
          replyToCommentId: resolvedReplyToCommentId,
        },
        select: commentSelect,
      });

      await tx.communityPost.update({
        where: { id: postId },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      });

      let memberTarget = member;

      if (hasMinimumMeaningfulTextLength(trimmedContent)) {
        const textReward = await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.commentText,
          reason: "COMMUNITY_POST_COMMENT_TEXT",
          sourceType: "COMMUNITY_POST_COMMENT",
          sourceId: comment.id,
        });

        memberTarget = {
          ...memberTarget,
          xp: textReward.nextXp,
          level: textReward.nextLevel,
        };
      }

      if (resolvedImageAssetId) {
        await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.commentImage,
          reason: "COMMUNITY_POST_COMMENT_IMAGE",
          sourceType: "COMMUNITY_POST_COMMENT",
          sourceId: comment.id,
        });
      }

      return comment;
    });

    if (commentBoardId) {
      await expressMemberCache.invalidate(commentBoardId, profile.id);
    }

    return NextResponse.json(serializeComment(createdComment, false));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "POST_NOT_FOUND") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      if (error.message === "POST_LOCKED") {
        return NextResponse.json(
          { error: "Comments are locked for this post" },
          { status: 403 },
        );
      }

      if (error.message === "REPLY_COMMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Reply target comment not found" },
          { status: 404 },
        );
      }

      if (error.message === "NOT_A_MEMBER") {
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      }

      try {
        const parsed = JSON.parse(error.message) as {
          type?: string;
          decision?: Parameters<typeof createAccessDeniedResponse>[0];
        };

        if (parsed.type === "ACCESS_DENIED" && parsed.decision) {
          return createAccessDeniedResponse(parsed.decision);
        }
      } catch {
        // noop
      }
    }

    console.error("[POST_COMMENTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
