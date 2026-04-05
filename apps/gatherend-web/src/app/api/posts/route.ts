import { AssetContext, AssetVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  awardMemberXp,
  canCreatePostWithImage,
  canCreateTextPost,
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
    const reputationScore = getProfileReputationScore(profile.reputationScore);

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
      boardId,
      title,
      content,
      imageAssetId,
    }: {
      boardId?: unknown;
      title?: unknown;
      content?: unknown;
      imageAssetId?: unknown;
    } = body;

    const rawTitle = title !== undefined && typeof title === "string" ? title.trim() : null;
    const trimmedTitle = rawTitle && rawTitle.length > 0 ? rawTitle : null;

    if (!boardId || typeof boardId !== "string" || !UUID_REGEX.test(boardId)) {
      return NextResponse.json(
        { error: "Board ID is required and must be valid" },
        { status: 400 },
      );
    }

    if (trimmedTitle !== null && trimmedTitle.length > MAX_TITLE_LENGTH) {
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

    if (trimmedTitle) {
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
    }

    const post = await db.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: {
          boardId_profileId: {
            boardId,
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

      const accessDecision = resolvedImageAssetId
        ? canCreatePostWithImage({
            level: member.level,
            reputationScore,
          })
        : canCreateTextPost({
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

      const createdPost = await tx.communityPost.create({
        data: {
          boardId,
          authorProfileId: profile.id,
          memberId: member.id,
          title: trimmedTitle ?? null,
          content: trimmedContent,
          imageAssetId: resolvedImageAssetId,
        },
        select: {
          id: true,
          boardId: true,
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

      let memberTarget = member;

      if (hasMinimumMeaningfulTextLength(trimmedContent)) {
        const textReward = await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.postText,
          reason: "COMMUNITY_POST_TEXT",
          sourceType: "COMMUNITY_POST",
          sourceId: createdPost.id,
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
          delta: MEMBER_XP_REWARDS.postImage,
          reason: "COMMUNITY_POST_IMAGE",
          sourceType: "COMMUNITY_POST",
          sourceId: createdPost.id,
        });
      }

      return createdPost;
    });

    await expressMemberCache.invalidate(boardId, profile.id);

    return NextResponse.json({
      id: post.id,
      boardId: post.boardId,
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
    if (error instanceof Error && error.message === "NOT_A_MEMBER") {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (error instanceof Error) {
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

    console.error("[POSTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
