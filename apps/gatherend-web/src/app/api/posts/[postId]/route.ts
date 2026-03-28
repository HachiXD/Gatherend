import { AssetContext, AssetVisibility } from "@prisma/client";
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { postId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
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
          AssetContext.COMMUNITY_POST_IMAGE,
          AssetVisibility.PUBLIC,
        );

        if (!imageAsset) {
          return NextResponse.json(
            { error: "Community post image asset not found" },
            { status: 400 },
          );
        }

        resolvedImageAssetId = imageAsset.id;
      }
    }

    if (
      content !== undefined &&
      trimmedContent.length > 0
    ) {
      const moderationResult = moderateDescription(trimmedContent);
      if (!moderationResult.allowed) {
        return NextResponse.json(
          {
            error: "MODERATION_BLOCKED",
            message:
              moderationResult.message ||
              "Post content contains prohibited content",
            reason: moderationResult.reason,
          },
          { status: 400 },
        );
      }
    }

    const updatedPost = await db.$transaction(async (tx) => {
      const existingPost = await tx.communityPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          content: true,
          deleted: true,
          authorProfileId: true,
          imageAssetId: true,
        },
      });

      if (!existingPost || existingPost.deleted) {
        throw new Error("POST_NOT_FOUND");
      }

      if (existingPost.authorProfileId !== profile.id) {
        throw new Error("FORBIDDEN");
      }

      const nextContent =
        content !== undefined ? trimmedContent : existingPost.content;
      const nextImageAssetId =
        resolvedImageAssetId !== undefined
          ? resolvedImageAssetId
          : existingPost.imageAssetId;

      if (!nextContent && !nextImageAssetId) {
        throw new Error("POST_EMPTY");
      }

      return tx.communityPost.update({
        where: { id: postId },
        data: {
          ...(content !== undefined && { content: trimmedContent }),
          ...(resolvedImageAssetId !== undefined && {
            imageAssetId: resolvedImageAssetId,
          }),
        },
        select: {
          id: true,
          communityId: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          pinnedAt: true,
          lockedAt: true,
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
        },
      });
    });

    return NextResponse.json({
      id: updatedPost.id,
      communityId: updatedPost.communityId,
      title: updatedPost.title,
      content: updatedPost.content,
      imageAsset: serializeUploadedAsset(updatedPost.imageAsset),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
      pinnedAt: updatedPost.pinnedAt?.toISOString() ?? null,
      lockedAt: updatedPost.lockedAt?.toISOString() ?? null,
      author: serializeProfileSummary(updatedPost.author),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "POST_NOT_FOUND") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { error: "Only the post creator can edit this post" },
          { status: 403 },
        );
      }

      if (error.message === "POST_EMPTY") {
        return NextResponse.json(
          { error: "Post must include content or an image" },
          { status: 400 },
        );
      }
    }

    console.error("[POST_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { postId } = await context.params;

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          deleted: true,
          authorProfileId: true,
          community: {
            select: {
              createdById: true,
              helpers: {
                where: { profileId: profile.id },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!post || post.deleted) {
        throw new Error("POST_NOT_FOUND");
      }

      const isAuthor = post.authorProfileId === profile.id;
      const isCommunityOwner = post.community.createdById === profile.id;
      const isCommunityHelper = post.community.helpers.length > 0;

      if (!isAuthor && !isCommunityOwner && !isCommunityHelper) {
        throw new Error("FORBIDDEN");
      }

      await tx.communityPost.update({
        where: { id: postId },
        data: {
          deleted: true,
          imageAssetId: null,
          title: "",
          content: "",
        },
      });
    });

    return NextResponse.json({ success: true, deletedPostId: postId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "POST_NOT_FOUND") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            error:
              "Only the post creator, community owner, or community helper can delete this post",
          },
          { status: 403 },
        );
      }
    }

    console.error("[POST_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
