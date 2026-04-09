import { requireAuth } from "@/lib/require-auth";
import { db } from "@/lib/db";
import { AuthProvider, AssetContext, AssetVisibility, Languages, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  expressAuthProfileCache,
  expressIdentityProfileCache,
  expressMemberCache,
  expressProfileCache,
  profileCache,
} from "@/lib/redis";
import { v4 as uuidv4 } from "uuid";
import {
  changeUsername,
  generateUniqueDiscriminator,
  normalizeUsername,
  validateUsername,
  MAX_DISCRIMINATORS,
} from "@/lib/username";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  profileCardConfigSchema,
  type ProfileCardConfig,
} from "@/lib/profile-card-config";
import { normalizeUsernameGradientStops } from "@/lib/username-gradient-stops";
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
  reputationScore: true,
  languages: true,
  badge: true,
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
  profileCardConfig: true,
  profileCardLeftTopImageAssetId: true,
  profileCardLeftBottomRightTopImageAssetId: true,
  profileCardLeftBottomRightBottomImageAssetId: true,
  profileCardRightTopImageAssetId: true,
  profileCardRightBottomImageAssetId: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  bannerAsset: {
    select: uploadedAssetSummarySelect,
  },
  profileCardLeftTopImageAsset: {
    select: uploadedAssetSummarySelect,
  },
  profileCardLeftBottomRightTopImageAsset: {
    select: uploadedAssetSummarySelect,
  },
  profileCardLeftBottomRightBottomImageAsset: {
    select: uploadedAssetSummarySelect,
  },
  profileCardRightTopImageAsset: {
    select: uploadedAssetSummarySelect,
  },
  profileCardRightBottomImageAsset: {
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

type ProfileCardImageSlotKey =
  | "profileCardLeftTopImageAssetId"
  | "profileCardLeftBottomRightTopImageAssetId"
  | "profileCardLeftBottomRightBottomImageAssetId"
  | "profileCardRightTopImageAssetId"
  | "profileCardRightBottomImageAssetId";

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
    profileCardLeftTopImageAsset: serializePublicAsset(
      profile.profileCardLeftTopImageAsset,
    ),
    profileCardLeftBottomRightTopImageAsset: serializePublicAsset(
      profile.profileCardLeftBottomRightTopImageAsset,
    ),
    profileCardLeftBottomRightBottomImageAsset: serializePublicAsset(
      profile.profileCardLeftBottomRightBottomImageAsset,
    ),
    profileCardRightTopImageAsset: serializePublicAsset(
      profile.profileCardRightTopImageAsset,
    ),
    profileCardRightBottomImageAsset: serializePublicAsset(
      profile.profileCardRightBottomImageAsset,
    ),
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
    profileCardConfig: profile.profileCardConfig,
    profileCardLeftTopImageAssetId: profile.profileCardLeftTopImageAssetId,
    profileCardLeftTopImageAsset: serializePublicAsset(
      profile.profileCardLeftTopImageAsset,
    ),
    profileCardLeftBottomRightTopImageAssetId:
      profile.profileCardLeftBottomRightTopImageAssetId,
    profileCardLeftBottomRightTopImageAsset: serializePublicAsset(
      profile.profileCardLeftBottomRightTopImageAsset,
    ),
    profileCardLeftBottomRightBottomImageAssetId:
      profile.profileCardLeftBottomRightBottomImageAssetId,
    profileCardLeftBottomRightBottomImageAsset: serializePublicAsset(
      profile.profileCardLeftBottomRightBottomImageAsset,
    ),
    profileCardRightTopImageAssetId: profile.profileCardRightTopImageAssetId,
    profileCardRightTopImageAsset: serializePublicAsset(
      profile.profileCardRightTopImageAsset,
    ),
    profileCardRightBottomImageAssetId:
      profile.profileCardRightBottomImageAssetId,
    profileCardRightBottomImageAsset: serializePublicAsset(
      profile.profileCardRightBottomImageAsset,
    ),
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
  };
}

async function resolveOwnedAssetId(
  input: {
    assetId: unknown;
    ownerProfileId: string;
    context: AssetContext;
    invalidMessage: string;
    notFoundMessage: string;
  },
): Promise<
  | { ok: true; value: string | null | undefined }
  | { ok: false; response: NextResponse }
> {
  const {
    assetId,
    ownerProfileId,
    context,
    invalidMessage,
    notFoundMessage,
  } = input;

  if (assetId === undefined) {
    return { ok: true, value: undefined };
  }

  if (assetId === null || assetId === "") {
    return { ok: true, value: null };
  }

  if (typeof assetId !== "string" || !UUID_REGEX.test(assetId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: invalidMessage }, { status: 400 }),
    };
  }

  const ownedAsset = await findOwnedUploadedAsset(
    assetId,
    ownerProfileId,
    context,
    AssetVisibility.PUBLIC,
  );

  if (!ownedAsset) {
    return {
      ok: false,
      response: NextResponse.json({ error: notFoundMessage }, { status: 400 }),
    };
  }

  return { ok: true, value: ownedAsset.id };
}

function validateProfileCardConfigAgainstSlots(
  config: ProfileCardConfig,
  effectiveImageSlots: Pick<ProfileResponseRecord, ProfileCardImageSlotKey>,
) {
  if (
    config.content.rightTopImage &&
    !effectiveImageSlots.profileCardRightTopImageAssetId
  ) {
    return "rightTopImage metadata requires a rightTopImage asset";
  }

  if (
    config.content.rightBottomImage &&
    !effectiveImageSlots.profileCardRightBottomImageAssetId
  ) {
    return "rightBottomImage metadata requires a rightBottomImage asset";
  }

  return null;
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
      profileCardConfig,
      profileCardLeftTopImageAssetId,
      profileCardLeftBottomRightTopImageAssetId,
      profileCardLeftBottomRightBottomImageAssetId,
      profileCardRightTopImageAssetId,
      profileCardRightBottomImageAssetId,
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

      const normalizedUsername = normalizeUsername(username);
      const validationError = validateUsername(normalizedUsername);

      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      if (normalizedUsername.length < 2) {
        return NextResponse.json(
          { error: "Username must be at least 2 characters" },
          { status: 400 },
        );
      }

      if (normalizedUsername.length > 20) {
        return NextResponse.json(
          { error: "Username must be at most 20 characters" },
          { status: 400 },
        );
      }

      const usedCount = await db.profile.count({
        where: {
          id: { not: profile.id },
          username: { equals: normalizedUsername, mode: "insensitive" },
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

      resolvedUsername = normalizedUsername;
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
            colorData.angle > 180
          ) {
            return NextResponse.json(
              { error: "Gradient angle must be 0-180" },
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

          colorData.colors = normalizeUsernameGradientStops(
            colorData.colors as Array<{ color: string; position: number }>,
          );
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

    let validatedProfileCardConfig: ProfileCardConfig | null | undefined =
      undefined;
    if (profileCardConfig !== undefined) {
      if (profileCardConfig === null) {
        validatedProfileCardConfig = null;
      } else {
        const parsedProfileCardConfig =
          profileCardConfigSchema.safeParse(profileCardConfig);
        if (!parsedProfileCardConfig.success) {
          return NextResponse.json(
            {
              error:
                parsedProfileCardConfig.error.issues[0]?.message ||
                "Invalid profileCardConfig",
            },
            { status: 400 },
          );
        }

        validatedProfileCardConfig = parsedProfileCardConfig.data;
      }
    }

    let resolvedAvatarAssetId: string | null | undefined = undefined;
    {
      const resolvedAvatar = await resolveOwnedAssetId({
        assetId: avatarAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_AVATAR,
        invalidMessage: "Avatar asset ID must be a valid UUID",
        notFoundMessage: "Avatar asset not found",
      });
      if (!resolvedAvatar.ok) return resolvedAvatar.response;
      resolvedAvatarAssetId = resolvedAvatar.value;
    }

    let resolvedBannerAssetId: string | null | undefined = undefined;
    {
      const resolvedBanner = await resolveOwnedAssetId({
        assetId: bannerAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_BANNER,
        invalidMessage: "Banner asset ID must be a valid UUID",
        notFoundMessage: "Banner asset not found",
      });
      if (!resolvedBanner.ok) return resolvedBanner.response;
      resolvedBannerAssetId = resolvedBanner.value;
    }

    let resolvedProfileCardLeftTopImageAssetId: string | null | undefined =
      undefined;
    {
      const resolvedLeftTopImage = await resolveOwnedAssetId({
        assetId: profileCardLeftTopImageAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_CARD_IMAGE,
        invalidMessage: "Left top image asset ID must be a valid UUID",
        notFoundMessage: "Left top image asset not found",
      });
      if (!resolvedLeftTopImage.ok) return resolvedLeftTopImage.response;
      resolvedProfileCardLeftTopImageAssetId = resolvedLeftTopImage.value;
    }

    let resolvedProfileCardLeftBottomRightTopImageAssetId:
      | string
      | null
      | undefined = undefined;
    {
      const resolvedLeftBottomRightTopImage = await resolveOwnedAssetId({
        assetId: profileCardLeftBottomRightTopImageAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_CARD_IMAGE,
        invalidMessage:
          "Left bottom right top image asset ID must be a valid UUID",
        notFoundMessage: "Left bottom right top image asset not found",
      });
      if (!resolvedLeftBottomRightTopImage.ok) {
        return resolvedLeftBottomRightTopImage.response;
      }
      resolvedProfileCardLeftBottomRightTopImageAssetId =
        resolvedLeftBottomRightTopImage.value;
    }

    let resolvedProfileCardLeftBottomRightBottomImageAssetId:
      | string
      | null
      | undefined = undefined;
    {
      const resolvedLeftBottomRightBottomImage = await resolveOwnedAssetId({
        assetId: profileCardLeftBottomRightBottomImageAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_CARD_IMAGE,
        invalidMessage:
          "Left bottom right bottom image asset ID must be a valid UUID",
        notFoundMessage: "Left bottom right bottom image asset not found",
      });
      if (!resolvedLeftBottomRightBottomImage.ok) {
        return resolvedLeftBottomRightBottomImage.response;
      }
      resolvedProfileCardLeftBottomRightBottomImageAssetId =
        resolvedLeftBottomRightBottomImage.value;
    }

    let resolvedProfileCardRightTopImageAssetId: string | null | undefined =
      undefined;
    {
      const resolvedRightTopImage = await resolveOwnedAssetId({
        assetId: profileCardRightTopImageAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_CARD_IMAGE,
        invalidMessage: "Right top image asset ID must be a valid UUID",
        notFoundMessage: "Right top image asset not found",
      });
      if (!resolvedRightTopImage.ok) return resolvedRightTopImage.response;
      resolvedProfileCardRightTopImageAssetId = resolvedRightTopImage.value;
    }

    let resolvedProfileCardRightBottomImageAssetId:
      | string
      | null
      | undefined = undefined;
    {
      const resolvedRightBottomImage = await resolveOwnedAssetId({
        assetId: profileCardRightBottomImageAssetId,
        ownerProfileId: profile.id,
        context: AssetContext.PROFILE_CARD_IMAGE,
        invalidMessage: "Right bottom image asset ID must be a valid UUID",
        notFoundMessage: "Right bottom image asset not found",
      });
      if (!resolvedRightBottomImage.ok) {
        return resolvedRightBottomImage.response;
      }
      resolvedProfileCardRightBottomImageAssetId = resolvedRightBottomImage.value;
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

    const effectiveProfileCardConfig =
      validatedProfileCardConfig !== undefined
        ? validatedProfileCardConfig
        : ((profile.profileCardConfig as ProfileCardConfig | null | undefined) ??
          null);

    if (effectiveProfileCardConfig) {
      const profileCardConfigError = validateProfileCardConfigAgainstSlots(
        effectiveProfileCardConfig,
        {
          profileCardLeftTopImageAssetId:
            resolvedProfileCardLeftTopImageAssetId !== undefined
              ? resolvedProfileCardLeftTopImageAssetId
              : profile.profileCardLeftTopImageAssetId,
          profileCardLeftBottomRightTopImageAssetId:
            resolvedProfileCardLeftBottomRightTopImageAssetId !== undefined
              ? resolvedProfileCardLeftBottomRightTopImageAssetId
              : profile.profileCardLeftBottomRightTopImageAssetId,
          profileCardLeftBottomRightBottomImageAssetId:
            resolvedProfileCardLeftBottomRightBottomImageAssetId !== undefined
              ? resolvedProfileCardLeftBottomRightBottomImageAssetId
              : profile.profileCardLeftBottomRightBottomImageAssetId,
          profileCardRightTopImageAssetId:
            resolvedProfileCardRightTopImageAssetId !== undefined
              ? resolvedProfileCardRightTopImageAssetId
              : profile.profileCardRightTopImageAssetId,
          profileCardRightBottomImageAssetId:
            resolvedProfileCardRightBottomImageAssetId !== undefined
              ? resolvedProfileCardRightBottomImageAssetId
              : profile.profileCardRightBottomImageAssetId,
        },
      );

      if (profileCardConfigError) {
        return NextResponse.json(
          { error: profileCardConfigError },
          { status: 400 },
        );
      }
    }

    const updateData: Prisma.ProfileUncheckedUpdateInput = {};

    if (resolvedAvatarAssetId !== undefined) {
      updateData.avatarAssetId = resolvedAvatarAssetId;
    }
    if (resolvedBannerAssetId !== undefined) {
      updateData.bannerAssetId = resolvedBannerAssetId;
    }
    if (resolvedProfileCardLeftTopImageAssetId !== undefined) {
      updateData.profileCardLeftTopImageAssetId =
        resolvedProfileCardLeftTopImageAssetId;
    }
    if (resolvedProfileCardLeftBottomRightTopImageAssetId !== undefined) {
      updateData.profileCardLeftBottomRightTopImageAssetId =
        resolvedProfileCardLeftBottomRightTopImageAssetId;
    }
    if (resolvedProfileCardLeftBottomRightBottomImageAssetId !== undefined) {
      updateData.profileCardLeftBottomRightBottomImageAssetId =
        resolvedProfileCardLeftBottomRightBottomImageAssetId;
    }
    if (resolvedProfileCardRightTopImageAssetId !== undefined) {
      updateData.profileCardRightTopImageAssetId =
        resolvedProfileCardRightTopImageAssetId;
    }
    if (resolvedProfileCardRightBottomImageAssetId !== undefined) {
      updateData.profileCardRightBottomImageAssetId =
        resolvedProfileCardRightBottomImageAssetId;
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
    if (validatedProfileCardConfig !== undefined) {
      updateData.profileCardConfig =
        validatedProfileCardConfig === null
          ? Prisma.JsonNull
          : (validatedProfileCardConfig as Prisma.InputJsonValue);
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

    await Promise.all([
      expressProfileCache.invalidate(profile.id),
      expressAuthProfileCache.invalidate(profile.userId),
      expressIdentityProfileCache.invalidateMany(
        identities.map((identity) => ({
          provider: identity.provider,
          providerUserId: identity.providerUserId,
        })),
      ),
      expressMemberCache.invalidateByProfileId(profile.id),
    ]);

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
        profileCardConfig: Prisma.JsonNull,
        profileCardLeftTopImageAssetId: null,
        profileCardLeftBottomRightTopImageAssetId: null,
        profileCardLeftBottomRightBottomImageAssetId: null,
        profileCardRightTopImageAssetId: null,
        profileCardRightBottomImageAssetId: null,
        email: "",
        usernameColor: Prisma.JsonNull,
        profileTags: [],
        badge: null,
        badgeStickerId: null,
        usernameFormat: Prisma.JsonNull,
        themeConfig: Prisma.JsonNull,
        languages: ["EN"],
        reportAccuracy: null,
        falseReports: 0,
        validReports: 0,
      },
      select: profileResponseSelect,
    });

    emitProfileUpdated(profile.id, buildRealtimeProfilePatch(deletedProfile));

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

    await Promise.all([
      expressProfileCache.invalidate(profile.id),
      expressAuthProfileCache.invalidate(profile.userId),
      expressIdentityProfileCache.invalidateMany(
        identities.map((identity) => ({
          provider: identity.provider,
          providerUserId: identity.providerUserId,
        })),
      ),
      expressMemberCache.invalidateByProfileId(profile.id),
    ]);

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
