/**
 * currentProfile() returns a cached snapshot of the signed-in profile.
 *
 * This app is in BetterAuth-only mode (cutover).
 */

import { cache } from "react";
import { AssetContext, AssetVisibility, Languages } from "@prisma/client";
import { db } from "@/lib/db";
import { profileCache } from "@/lib/redis";
import { normalizeLanguages } from "@/lib/detect-language";
import type { ProfileCardConfig } from "@/lib/profile-card-config";
import {
  generateUniqueDiscriminator,
  generateRandomUsername,
  sanitizeUsername,
} from "@/lib/username";
import { logger } from "@/lib/logger";
import {
  getServerSession,
  type ServerSession,
} from "@/lib/auth/server-session";
import {
  getProfileByIdentity,
  linkIdentityToProfile,
} from "@/lib/auth/identity";
import {
  serializePublicAsset,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const isDevelopment = process.env.NODE_ENV !== "production";

type UploadedAssetSummary = {
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
};

type SerializedUploadedAsset = ReturnType<typeof serializePublicAsset>;

export type ProfileData = {
  id: string;
  userId: string;
  username: string;
  discriminator: string | null;
  email: string;
  reputationScore: number;
  languages: Languages[];
  usernameColor: unknown;
  profileTags: string[];
  badge: string | null;
  usernameFormat: unknown;
  themeConfig: unknown;
  profileCardConfig: ProfileCardConfig | null;
  banned: boolean;
  bannedAt: Date | null;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  avatarAssetId: string | null;
  bannerAssetId: string | null;
  badgeStickerId: string | null;
  profileCardLeftTopImageAssetId: string | null;
  profileCardLeftBottomRightTopImageAssetId: string | null;
  profileCardLeftBottomRightBottomImageAssetId: string | null;
  profileCardRightTopImageAssetId: string | null;
  profileCardRightBottomImageAssetId: string | null;
  avatarAsset: SerializedUploadedAsset;
  bannerAsset: SerializedUploadedAsset;
  profileCardLeftTopImageAsset: SerializedUploadedAsset;
  profileCardLeftBottomRightTopImageAsset: SerializedUploadedAsset;
  profileCardLeftBottomRightBottomImageAsset: SerializedUploadedAsset;
  profileCardRightTopImageAsset: SerializedUploadedAsset;
  profileCardRightBottomImageAsset: SerializedUploadedAsset;
  badgeSticker:
    | {
        id: string;
        asset: SerializedUploadedAsset;
      }
    | null;
};

const profileSelect = {
  id: true,
  userId: true,
  username: true,
  discriminator: true,
  email: true,
  reputationScore: true,
  languages: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  themeConfig: true,
  profileCardConfig: true,
  banned: true,
  bannedAt: true,
  banReason: true,
  createdAt: true,
  updatedAt: true,
  avatarAssetId: true,
  bannerAssetId: true,
  badgeStickerId: true,
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
} as const;

type ProfileRecord = {
  id: string;
  userId: string;
  username: string;
  discriminator: string | null;
  email: string;
  reputationScore: number;
  languages: Languages[];
  usernameColor: unknown;
  profileTags: string[];
  badge: string | null;
  usernameFormat: unknown;
  themeConfig: unknown;
  profileCardConfig: ProfileCardConfig | null;
  banned: boolean;
  bannedAt: Date | null;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  avatarAssetId: string | null;
  bannerAssetId: string | null;
  badgeStickerId: string | null;
  profileCardLeftTopImageAssetId: string | null;
  profileCardLeftBottomRightTopImageAssetId: string | null;
  profileCardLeftBottomRightBottomImageAssetId: string | null;
  profileCardRightTopImageAssetId: string | null;
  profileCardRightBottomImageAssetId: string | null;
  avatarAsset: UploadedAssetSummary | null;
  bannerAsset: UploadedAssetSummary | null;
  profileCardLeftTopImageAsset: UploadedAssetSummary | null;
  profileCardLeftBottomRightTopImageAsset: UploadedAssetSummary | null;
  profileCardLeftBottomRightBottomImageAsset: UploadedAssetSummary | null;
  profileCardRightTopImageAsset: UploadedAssetSummary | null;
  profileCardRightBottomImageAsset: UploadedAssetSummary | null;
  badgeSticker:
    | {
        id: string;
        asset: UploadedAssetSummary;
      }
    | null;
};

function serializeProfileRecord(profile: ProfileRecord): ProfileData {
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

const devLog = (...args: Parameters<typeof logger.server>) => {
  if (isDevelopment) {
    logger.server(...args);
  }
};

function getProfileCacheKey(session: ServerSession): string {
  return `betterauth:${session.userId}`;
}

function needsNormalization(languages: Languages[] | null): boolean {
  if (!Array.isArray(languages) || languages.length === 0) return true;
  const normalized = normalizeLanguages(languages);
  return JSON.stringify(languages) !== JSON.stringify(normalized);
}

async function updateProfileLanguages(
  profileId: string,
  profile: { languages: Languages[] | null },
): Promise<ProfileData> {
  const normalized = normalizeLanguages(profile.languages || undefined);
  const updatedProfile = await db.profile.update({
    where: { id: profileId },
    data: { languages: normalized },
    select: profileSelect,
  });

  return serializeProfileRecord(updatedProfile as ProfileRecord);
}

async function safeLinkIdentity(providerUserId: string, profileId: string) {
  try {
    await linkIdentityToProfile({
      providerUserId,
      profileId,
    });
  } catch (error) {
    logger.error("[CURRENT_PROFILE] Failed to link identity:", error);
  }
}

async function findProfileBySession(
  session: ServerSession,
): Promise<ProfileData | null> {
  const byIdentity = await getProfileByIdentity({
    providerUserId: session.userId,
  });

  const profileId = byIdentity?.id
    ? byIdentity.id
    : ((
        await db.profile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        })
      )?.id ?? null);

  if (!profileId) {
    return null;
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: profileSelect,
  });

  if (!profile) {
    return null;
  }

  await safeLinkIdentity(session.userId, profile.id);
  await ensureUserNameMatchesProfile(session, profile);
  return serializeProfileRecord(profile as ProfileRecord);
}

async function resolveInitialUsername(
  session: ServerSession,
  providerId: string | null,
): Promise<string> {
  // Never derive product-facing usernames from Google profile fields.
  // This also helps overwrite legacy `user.name` values that might contain PII.
  if (providerId === "google") {
    return generateRandomUsername();
  }

  if (session.name) {
    const candidate = sanitizeUsername(session.name);
    if (candidate) {
      return candidate;
    }
  }

  return generateRandomUsername();
}

async function ensureUserNameMatchesProfile(
  session: ServerSession,
  profile: { userId: string; username: string },
) {
  if (session.name && session.name === profile.username) {
    return;
  }

  try {
    await db.user.update({
      where: { id: profile.userId },
      data: { name: profile.username },
      select: { id: true },
    });
  } catch (error) {
    logger.error(
      "[CURRENT_PROFILE] Failed to sync user.name to profile:",
      error,
    );
  }
}

async function resolvePrimaryProviderId(
  session: ServerSession,
): Promise<string | null> {
  try {
    const account = await db.account.findFirst({
      where: { userId: session.userId },
      select: { providerId: true },
      orderBy: { createdAt: "asc" },
    });

    return account?.providerId?.toLowerCase() ?? null;
  } catch (error) {
    logger.error("[CURRENT_PROFILE] Failed to resolve auth provider:", error);
    return null;
  }
}

async function createProfileForSession(
  session: ServerSession,
): Promise<ProfileData | null> {
  const providerId = await resolvePrimaryProviderId(session);
  const username = await resolveInitialUsername(session, providerId);

  const discriminator = await generateUniqueDiscriminator(username);
  const normalizedLangs = normalizeLanguages(undefined);

  try {
    const profile = await db.profile.create({
      data: {
        userId: session.userId,
        username,
        discriminator,
        email: session.email ?? "",
        languages: normalizedLangs,
      },
      select: profileSelect,
    });

    await safeLinkIdentity(session.userId, profile.id);
    await ensureUserNameMatchesProfile(session, profile);
    return serializeProfileRecord(profile as ProfileRecord);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existing = await db.profile.findUnique({
        where: { userId: session.userId },
        select: profileSelect,
      });
      if (existing) {
        await safeLinkIdentity(session.userId, existing.id);
        await ensureUserNameMatchesProfile(session, existing);
        return serializeProfileRecord(existing as ProfileRecord);
      }
    }
    throw error;
  }
}

export const currentProfile = cache(async (): Promise<ProfileData | null> => {
  try {
    devLog("[CURRENT_PROFILE] Starting...");

    const session = await getServerSession();
    if (!session?.userId) {
      devLog("[CURRENT_PROFILE] No session userId, returning null");
      return null;
    }

    const cacheKey = getProfileCacheKey(session);
    devLog("[CURRENT_PROFILE] userId:", session.userId);

    const cachedProfile = await profileCache.get<ProfileData>(cacheKey);
    if (cachedProfile) {
      devLog("[CURRENT_PROFILE] Redis cache hit");
      return cachedProfile;
    }

    let profile = await findProfileBySession(session);
    devLog("[CURRENT_PROFILE] Profile found:", !!profile, profile?.id);

    if (profile) {
      if (needsNormalization(profile.languages)) {
        profile = await updateProfileLanguages(profile.id, profile);
      }
      await profileCache.set(cacheKey, profile);
      return profile;
    }

    devLog("[CURRENT_PROFILE] Profile not found, creating new...");
    profile = await createProfileForSession(session);
    if (!profile) {
      return null;
    }

    await profileCache.set(cacheKey, profile);
    return profile;
  } catch (error) {
    logger.error("[CURRENT_PROFILE] Fatal error:", error);
    throw error;
  }
});
