import { requireAuth } from "@/lib/require-auth";
import { db } from "@/lib/db";
import { AuthProvider, AssetContext, AssetVisibility, Languages, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { profileCache } from "@/lib/redis";
import { v4 as uuidv4 } from "uuid";
import {
  changeUsername,
  generateUniqueDiscriminator,
  sanitizeUsername,
  MAX_DISCRIMINATORS,
} from "@/lib/username";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  UUID_REGEX,
  findOwnedSticker,
  findOwnedUploadedAsset,
  serializePublicAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const profileResponseSelect = {
  id: true,
  userId: true,
  username: true,
  discriminator: true,
  email: true,
  languages: true,
  badge: true,
  longDescription: true,
  themeConfig: true,
  banReason: true,
  banned: true,
  bannedAt: true,
  falseReports: true,
  reportAccuracy: true,
  validReports: true,
  profileTags: true,
  usernameColor: true,
  usernameFormat: true,
  createdAt: true,
  updatedAt: true,
  avatarAssetId: true,
  bannerAssetId: true,
  badgeStickerId: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  bannerAsset: {
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
} satisfies Prisma.ProfileSelect;

type ProfileResponseRecord = Prisma.ProfileGetPayload<{
  select: typeof profileResponseSelect;
}>;

async function emitProfileUpdated(
  profileId: string,
  patch: Record<string, unknown>,
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    if (!socketUrl || !secret) return;

    fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `profile-watch:${profileId}`,
        event: "profile:updated",
        data: { profileId, patch, timestamp: Date.now() },
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
  } catch {
    // noop
  }
}

function serializeProfileResponse(profile: ProfileResponseRecord) {
  return {
    ...profile,
    avatarAsset: serializePublicAsset(profile.avatarAsset),
    bannerAsset: serializePublicAsset(profile.bannerAsset),
    badgeSticker: profile.badgeSticker
      ? {
          id: profile.badgeSticker.id,
          asset: serializePublicAsset(profile.badgeSticker.asset),
        }
      : null,
  };
}

function buildRealtimeProfilePatch(profile: ProfileResponseRecord) {
  return {
    username: profile.username,
    discriminator: profile.discriminator,
    avatarAssetId: profile.avatarAssetId,
    avatarAsset: serializePublicAsset(profile.avatarAsset),
    bannerAssetId: profile.bannerAssetId,
    bannerAsset: serializePublicAsset(profile.bannerAsset),
    usernameColor: profile.usernameColor,
    usernameFormat: profile.usernameFormat,
    badge: profile.badge,
    badgeStickerId: profile.badgeStickerId,
    badgeSticker: profile.badgeSticker
      ? {
          id: profile.badgeSticker.id,
          asset: serializePublicAsset(profile.badgeSticker.asset),
        }
      : null,
    longDescription: profile.longDescription,
  };
}

export async function GET() {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    const currentProfile = await db.profile.findUnique({
      where: { id: profile.id },
      select: profileResponseSelect,
    });

    if (!currentProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(serializeProfileResponse(currentProfile));
  } catch (error) {
    console.error("[PROFILE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
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
      username,
      avatarAssetId,
      bannerAssetId,
      languages,
      usernameColor,
      profileTags,
      badge,
      badgeStickerId,
      usernameFormat,
      longDescription,
    } = body as Record<string, unknown>;

    let resolvedUsername: string | undefined;

    if (username !== undefined && !profile.discriminator) {
      return NextResponse.json(
        { error: "Profile missing discriminator, cannot update username" },
        { status: 400 },
      );
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return NextResponse.json(
          { error: "Username must be a string" },
          { status: 400 },
        );
      }

      const sanitizedUsername = sanitizeUsername(username);

      if (sanitizedUsername.length < 2) {
        return NextResponse.json(
          { error: "Username must be at least 2 characters" },
          { status: 400 },
        );
      }

      if (sanitizedUsername.length > 20) {
        return NextResponse.json(
          { error: "Username must be at most 20 characters" },
          { status: 400 },
        );
      }

      const usedCount = await db.profile.count({
        where: {
          id: { not: profile.id },
          username: { equals: sanitizedUsername, mode: "insensitive" },
        },
      });

      if (usedCount >= MAX_DISCRIMINATORS) {
        return NextResponse.json(
          {
            error:
              "This username is no longer available. Please choose a different one.",
          },
          { status: 400 },
        );
      }

      resolvedUsername = sanitizedUsername;
    }

    if (usernameColor !== undefined && usernameColor !== null) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      if (typeof usernameColor === "object") {
        const colorData = usernameColor as Record<string, unknown>;

        if (colorData.type === "solid") {
          if (
            typeof colorData.color !== "string" ||
            !hexColorRegex.test(colorData.color)
          ) {
            return NextResponse.json(
              { error: "Invalid solid color format" },
              { status: 400 },
            );
          }
        } else if (colorData.type === "gradient") {
          if (
            !Array.isArray(colorData.colors) ||
            colorData.colors.length < 2 ||
            colorData.colors.length > 4
          ) {
            return NextResponse.json(
              { error: "Gradient must have 2-4 color stops" },
              { status: 400 },
            );
          }

          for (const colorStop of colorData.colors) {
            if (
              typeof colorStop !== "object" ||
              !colorStop ||
              typeof (colorStop as Record<string, unknown>).color !== "string" ||
              typeof (colorStop as Record<string, unknown>).position !== "number"
            ) {
              return NextResponse.json(
                { error: "Invalid color stop format" },
                { status: 400 },
              );
            }

            if (
              !hexColorRegex.test(
                (colorStop as Record<string, unknown>).color as string,
              )
            ) {
              return NextResponse.json(
                { error: "Invalid gradient color format" },
                { status: 400 },
              );
            }

            const position = (colorStop as Record<string, unknown>)
              .position as number;
            if (position < 0 || position > 100) {
              return NextResponse.json(
                { error: "Color position must be 0-100" },
                { status: 400 },
              );
            }
          }

          if (
            typeof colorData.angle !== "number" ||
            colorData.angle < 0 ||
            colorData.angle > 360
          ) {
            return NextResponse.json(
              { error: "Gradient angle must be 0-360" },
              { status: 400 },
            );
          }

          if (
            colorData.animationType &&
            !["shift", "shimmer", "pulse"].includes(
              colorData.animationType as string,
            )
          ) {
            return NextResponse.json(
              { error: "Invalid animation type" },
              { status: 400 },
            );
          }
        } else {
          return NextResponse.json(
            { error: "Invalid usernameColor type" },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Invalid usernameColor format" },
          { status: 400 },
        );
      }
    }

    if (profileTags !== undefined && profileTags !== null) {
      if (!Array.isArray(profileTags)) {
        return NextResponse.json(
          { error: "Profile tags must be an array" },
          { status: 400 },
        );
      }

      if (profileTags.length > 10) {
        return NextResponse.json(
          { error: "Maximum 10 profile tags allowed" },
          { status: 400 },
        );
      }

      for (const tag of profileTags) {
        if (typeof tag !== "string" || tag.length > 10 || tag.length < 1) {
          return NextResponse.json(
            { error: "Each tag must be 1-10 characters" },
            { status: 400 },
          );
        }

        if (!/^[a-zA-Z0-9Ã¡Ã©Ã­Ã³ÃºÃ±ÃÃ‰ÃÃ“ÃšÃ‘\s\-_]+$/.test(tag)) {
          return NextResponse.json(
            {
              error:
                "Tags can only contain letters, numbers, spaces, and hyphens",
            },
            { status: 400 },
          );
        }
      }
    }

    if (badge !== undefined && badge !== null && typeof badge === "string" && badge.length > 30) {
      return NextResponse.json(
        { error: "Badge must be 30 characters or less" },
        { status: 400 },
      );
    }

    if (
      longDescription !== undefined &&
      longDescription !== null &&
      typeof longDescription === "string" &&
      longDescription.length > 200
    ) {
      return NextResponse.json(
        { error: "Description must be 200 characters or less" },
        { status: 400 },
      );
    }

    if (usernameFormat !== undefined && usernameFormat !== null) {
      if (typeof usernameFormat !== "object") {
        return NextResponse.json(
          { error: "Invalid username format - must be an object" },
          { status: 400 },
        );
      }

      const formatData = usernameFormat as Record<string, unknown>;
      if (formatData.bold !== undefined && typeof formatData.bold !== "boolean") {
        return NextResponse.json(
          { error: "Invalid username format - bold must be boolean" },
          { status: 400 },
        );
      }

      if (
        formatData.italic !== undefined &&
        typeof formatData.italic !== "boolean"
      ) {
        return NextResponse.json(
          { error: "Invalid username format - italic must be boolean" },
          { status: 400 },
        );
      }

      if (
        formatData.underline !== undefined &&
        typeof formatData.underline !== "boolean"
      ) {
        return NextResponse.json(
          { error: "Invalid username format - underline must be boolean" },
          { status: 400 },
        );
      }
    }

    let resolvedAvatarAssetId: string | null | undefined = undefined;
    if (avatarAssetId !== undefined) {
      if (avatarAssetId === null || avatarAssetId === "") {
        resolvedAvatarAssetId = null;
      } else if (typeof avatarAssetId !== "string" || !UUID_REGEX.test(avatarAssetId)) {
        return NextResponse.json(
          { error: "Avatar asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const avatarAsset = await findOwnedUploadedAsset(
          avatarAssetId,
          profile.id,
          AssetContext.PROFILE_AVATAR,
          AssetVisibility.PUBLIC,
        );

        if (!avatarAsset) {
          return NextResponse.json(
            { error: "Avatar asset not found" },
            { status: 400 },
          );
        }

        resolvedAvatarAssetId = avatarAsset.id;
      }
    }

    let resolvedBannerAssetId: string | null | undefined = undefined;
    if (bannerAssetId !== undefined) {
      if (bannerAssetId === null || bannerAssetId === "") {
        resolvedBannerAssetId = null;
      } else if (typeof bannerAssetId !== "string" || !UUID_REGEX.test(bannerAssetId)) {
        return NextResponse.json(
          { error: "Banner asset ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const bannerAsset = await findOwnedUploadedAsset(
          bannerAssetId,
          profile.id,
          AssetContext.PROFILE_BANNER,
          AssetVisibility.PUBLIC,
        );

        if (!bannerAsset) {
          return NextResponse.json(
            { error: "Banner asset not found" },
            { status: 400 },
          );
        }

        resolvedBannerAssetId = bannerAsset.id;
      }
    }

    let resolvedBadgeStickerId: string | null | undefined = undefined;
    if (badgeStickerId !== undefined) {
      if (badgeStickerId === null || badgeStickerId === "") {
        resolvedBadgeStickerId = null;
      } else if (typeof badgeStickerId !== "string" || !UUID_REGEX.test(badgeStickerId)) {
        return NextResponse.json(
          { error: "Badge sticker ID must be a valid UUID" },
          { status: 400 },
        );
      } else {
        const badgeSticker = await findOwnedSticker(badgeStickerId, profile.id);
        if (!badgeSticker) {
          return NextResponse.json(
            { error: "Badge sticker not found" },
            { status: 400 },
          );
        }

        resolvedBadgeStickerId = badgeSticker.id;
      }
    }

    const updateData: Prisma.ProfileUncheckedUpdateInput = {};

    if (resolvedAvatarAssetId !== undefined) {
      updateData.avatarAssetId = resolvedAvatarAssetId;
    }
    if (resolvedBannerAssetId !== undefined) {
      updateData.bannerAssetId = resolvedBannerAssetId;
    }
    if (languages !== undefined) updateData.languages = languages as Languages[];
    if (usernameColor !== undefined) {
      updateData.usernameColor = usernameColor as Prisma.InputJsonValue;
    }
    if (profileTags !== undefined) updateData.profileTags = profileTags as string[];
    if (badge !== undefined) updateData.badge = badge as string | null;
    if (resolvedBadgeStickerId !== undefined) {
      updateData.badgeStickerId = resolvedBadgeStickerId;
    }
    if (usernameFormat !== undefined) {
      updateData.usernameFormat = usernameFormat as Prisma.InputJsonValue;
    }
    if (longDescription !== undefined) {
      updateData.longDescription = longDescription as string | null;
    }

    if (resolvedUsername !== undefined) {
      await changeUsername(profile.id, resolvedUsername);
    }

    const updatedProfile =
      Object.keys(updateData).length > 0
        ? await db.profile.update({
            where: { id: profile.id },
            data: updateData,
            select: profileResponseSelect,
          })
        : await db.profile.findUnique({
            where: { id: profile.id },
            select: profileResponseSelect,
          });

    if (!updatedProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    await profileCache.invalidate(profile.userId);
    await profileCache.invalidate(`betterauth:${profile.userId}`);

    const identities = await db.authIdentity.findMany({
      where: { profileId: profile.id },
      select: { provider: true, providerUserId: true },
    });

    for (const identity of identities) {
      const cacheKey =
        identity.provider === AuthProvider.BETTER_AUTH
          ? `betterauth:${identity.providerUserId}`
          : identity.providerUserId;
      await profileCache.invalidate(cacheKey);
    }

    emitProfileUpdated(profile.id, buildRealtimeProfilePatch(updatedProfile));

    return NextResponse.json(serializeProfileResponse(updatedProfile));
  } catch (error) {
    console.error("[PROFILE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const shortId = uuidv4().slice(0, 8);
    const anonymizedUsername = `Deleted_User_${shortId}`;
    const anonymizedDiscriminator =
      await generateUniqueDiscriminator(anonymizedUsername);

    const deletedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        username: anonymizedUsername,
        discriminator: anonymizedDiscriminator,
        avatarAssetId: null,
        bannerAssetId: null,
        email: "",
        usernameColor: Prisma.JsonNull,
        profileTags: [],
        badge: null,
        badgeStickerId: null,
        usernameFormat: Prisma.JsonNull,
        longDescription: null,
        themeConfig: Prisma.JsonNull,
        languages: ["EN"],
        reportAccuracy: null,
        falseReports: 0,
        validReports: 0,
      },
      select: profileResponseSelect,
    });

    emitProfileUpdated(profile.id, {
      username: deletedProfile.username,
      discriminator: deletedProfile.discriminator,
      avatarAssetId: deletedProfile.avatarAssetId,
      bannerAssetId: deletedProfile.bannerAssetId,
      usernameColor: deletedProfile.usernameColor,
      usernameFormat: deletedProfile.usernameFormat,
      badge: deletedProfile.badge,
      badgeStickerId: deletedProfile.badgeStickerId,
      longDescription: deletedProfile.longDescription,
    });

    await profileCache.invalidate(profile.userId);

    const identities = await db.authIdentity.findMany({
      where: { profileId: profile.id },
      select: { provider: true, providerUserId: true },
    });

    for (const identity of identities) {
      const cacheKey =
        identity.provider === AuthProvider.BETTER_AUTH
          ? `betterauth:${identity.providerUserId}`
          : identity.providerUserId;
      await profileCache.invalidate(cacheKey);
    }

    const betterAuthIdentity = identities.find(
      (identity) => identity.provider === AuthProvider.BETTER_AUTH,
    );
    if (betterAuthIdentity) {
      await db.session.deleteMany({
        where: { userId: betterAuthIdentity.providerUserId },
      });
      await db.user
        .delete({
          where: { id: betterAuthIdentity.providerUserId },
        })
        .catch(() => null);
      await db.authIdentity
        .deleteMany({
          where: {
            profileId: profile.id,
            provider: AuthProvider.BETTER_AUTH,
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
      profile: serializeProfileResponse(deletedProfile),
    });
  } catch (error) {
    console.error("[PROFILE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
