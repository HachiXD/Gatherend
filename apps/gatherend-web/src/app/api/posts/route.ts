import { AssetContext, AssetVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { moderateDescription } from "@/lib/text-moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedUploadedAsset,
  serializeUploadedAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const MAX_CONTENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

export async function POST(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.boardCreate);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      communityId,
      title,
      content,
      imageAssetId,
    }: {
      communityId?: unknown;
      title?: unknown;
      content?: unknown;
      imageAssetId?: unknown;
    } = body;

    if (!communityId || typeof communityId !== "string" || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Community ID is required and must be valid" },
        { status: 400 },
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 },
      );
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 },
      );
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 },
      );
    }

    const trimmedContent = (content ?? "").trim();
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
        },
        { status: 400 },
      );
    }

    let resolvedImageAssetId: string | null = null;
    if (imageAssetId !== undefined && imageAssetId !== null && imageAssetId !== "") {
      if (typeof imageAssetId !== "string" || !UUID_REGEX.test(imageAssetId)) {
        return NextResponse.json(
          { error: "Image asset ID must be a valid UUID" },
          { status: 400 },
        );
      }

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

    if (!trimmedContent && !resolvedImageAssetId) {
      return NextResponse.json(
        { error: "Post must include content or an image" },
        { status: 400 },
      );
    }

    if (trimmedContent) {
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

    const titleModerationResult = moderateDescription(trimmedTitle);
    if (!titleModerationResult.allowed) {
      return NextResponse.json(
        {
          error: "MODERATION_BLOCKED",
          message:
            titleModerationResult.message ||
            "Post title contains prohibited content",
          reason: titleModerationResult.reason,
        },
        { status: 400 },
      );
    }

    const community = await db.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }

    const post = await db.communityPost.create({
      data: {
        communityId,
        authorProfileId: profile.id,
        title: trimmedTitle,
        content: trimmedContent,
        imageAssetId: resolvedImageAssetId,
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
            avatarAsset: {
              select: uploadedAssetSummarySelect,
            },
          },
        },
      },
    });

    return NextResponse.json({
      id: post.id,
      communityId: post.communityId,
      title: post.title,
      content: post.content,
      imageAsset: serializeUploadedAsset(post.imageAsset),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      pinnedAt: post.pinnedAt?.toISOString() ?? null,
      lockedAt: post.lockedAt?.toISOString() ?? null,
      author: {
        ...post.author,
        avatarAsset: serializeUploadedAsset(post.author.avatarAsset),
      },
    });
  } catch (error) {
    console.error("[POSTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
