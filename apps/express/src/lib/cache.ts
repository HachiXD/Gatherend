/**
 * Redis Cache Service
 *
 * Caching layer for frequently accessed data to reduce DB load.
 * Uses Redis for distributed caching across multiple server instances.
 *
 * Cache Keys (Might be outdated xD):
 * - auth:profile:{userId} → Auth profile data by legacy userId (TTL: 2 min)
 * - member:{boardId}:{profileId} → Member verification (TTL: 5 min)
 * - channel:{channelId} → Channel data (TTL: 5 min)
 * - profile:{profileId} → Profile data (TTL: 5 min)
 * - voice:channels:{boardId} → Voice channel IDs for a board (TTL: 5 min)
 * - board:{boardId}:meta → Board metadata (TTL: 5 min)
 *
 */

import { getRedisClient, isRedisConfigured } from "./redis.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { AuthProvider, type Prisma } from "@prisma/client";
import { uploadedAssetSelect } from "./uploaded-assets.js";

// Cache TTLs in seconds
const CACHE_TTL = {
  MEMBER: 300,
  CHANNEL: 300,
  PROFILE: 300,
  BOARD_META: 300,
};

// Profile select fields
const PROFILE_SELECT = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSelect,
      },
    },
  },
};

/**
 * Generic cache get/set helper
 */
async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;

  try {
    const redis = getRedisClient();
    const cached = await redis.get(key);
    if (cached && typeof cached === "string") {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    logger.warn(`Cache get error for ${key}:`, error);
    return null;
  }
}

async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const redis = getRedisClient();
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.warn(`Cache set error for ${key}:`, error);
  }
}

async function cacheDelete(key: string): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    logger.warn(`Cache delete error for ${key}:`, error);
  }
}

/**
 * Delete multiple cache keys by pattern
 * Uses SCAN instead of KEYS to avoid blocking Redis (O(1) vs O(n))
 */
async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const redis = getRedisClient();
    let cursor = "0";
    let totalDeleted = 0;

    // To avoid blocking Redis
    do {
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = result.cursor.toString();
      const keys = result.keys;

      if (keys.length > 0) {
        await redis.del(keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn(`Cache delete pattern error for ${pattern}:`, error);
  }
}

// MEMBER VERIFICATION CACHE

interface CachedMemberProfile {
  id: string;
  username: string;
  discriminator: string | null;
  usernameColor: Prisma.JsonValue | null;
  profileTags: string[];
  badge: string | null;
  usernameFormat: Prisma.JsonValue | null;
  avatarAsset: {
    id: string;
    key: string;
    visibility: string;
    context: string;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
  } | null;
  badgeSticker:
    | {
        id: string;
        asset: {
          id: string;
          key: string;
          visibility: string;
          context: string;
          mimeType: string;
          sizeBytes: number | null;
          width: number | null;
          height: number | null;
          originalName: string | null;
        };
      }
    | null;
}

interface CachedMember {
  id: string;
  role: string;
  profileId: string;
  boardId: string;
  profile: CachedMemberProfile;
}

interface CachedBoardWithMembers {
  id: string;
  name: string;
  members: CachedMember[];
}

/**
 * Verify member is in board with caching
 * This is called on EVERY message send, so caching is necessary
 */
export async function verifyMemberInBoardCached(
  profileId: string,
  boardId: string,
): Promise<CachedBoardWithMembers | null> {
  const cacheKey = `member:${boardId}:${profileId}`;

  // Try cache first
  const cached = await cacheGet<CachedBoardWithMembers>(cacheKey);
  if (cached) return cached;

  // Query DB
  const board = await db.board.findFirst({
    where: {
      id: boardId,
      members: { some: { profileId } },
    },
    select: {
      id: true,
      name: true,
      members: {
        where: { profileId },
        select: {
          id: true,
          role: true,
          profileId: true,
          boardId: true,
          profile: {
            select: PROFILE_SELECT,
          },
        },
      },
    },
  });

  if (board) {
    // Cache the result
    await cacheSet(cacheKey, board, CACHE_TTL.MEMBER);
  }

  return board;
}

/**
 * Invalidate member cache when member is updated/removed
 */
export async function invalidateMemberCache(
  profileId: string,
  boardId: string,
): Promise<void> {
  await cacheDelete(`member:${boardId}:${profileId}`);
}

// CHANNEL CACHE

interface CachedChannel {
  id: string;
  name: string;
  type: string;
  boardId: string;
}

/**
 * Find channel with caching
 */
export async function findChannelCached(
  boardId: string,
  channelId: string,
): Promise<CachedChannel | null> {
  const cacheKey = `channel:${channelId}`;

  // Try cache first
  const cached = await cacheGet<CachedChannel>(cacheKey);
  if (cached) {
    // Verify boardId matches (security check)
    if (cached.boardId !== boardId) return null;
    return cached;
  }

  // Query DB
  const channel = await db.channel.findFirst({
    where: { id: channelId, boardId },
    select: {
      id: true,
      name: true,
      type: true,
      boardId: true,
    },
  });

  if (channel) {
    await cacheSet(cacheKey, channel, CACHE_TTL.CHANNEL);
  }

  return channel;
}

/**
 * Get channel by ID only (without boardId verification)
 * Used when we need to look up the boardId for a channel
 * WARNING: Do not use this for authorization checks - use findChannelCached instead
 */
export async function getChannelByIdCached(
  channelId: string,
): Promise<CachedChannel | null> {
  const cacheKey = `channel:${channelId}`;

  // Try cache first
  const cached = await cacheGet<CachedChannel>(cacheKey);
  if (cached) return cached;

  // Query DB
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      type: true,
      boardId: true,
    },
  });

  if (channel) {
    await cacheSet(cacheKey, channel, CACHE_TTL.CHANNEL);
  }

  return channel;
}

/**
 * Invalidate channel cache
 */
export async function invalidateChannelCache(channelId: string): Promise<void> {
  await cacheDelete(`channel:${channelId}`);
}

// CONVERSATION CACHE (for DMs)

interface CachedConversationProfile {
  id: string;
  username: string;
  discriminator: string;
  avatarAsset: {
    id: string;
    key: string;
    visibility: string;
    context: string;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
  } | null;
}

interface CachedConversation {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  profileOne: CachedConversationProfile;
  profileTwo: CachedConversationProfile;
}

interface CachedConversationResult {
  conversation: CachedConversation;
  currentProfileId: string;
  otherProfileId: string;
}

/**
 * Verify user belongs to conversation with caching
 * This is called on EVERY DM request, so caching is critical
 *
 * TTL: 5 minutes - conversations don't change often
 * Invalidation: When conversation is deleted
 */
export async function findConversationForProfileCached(
  profileId: string,
  conversationId: string,
): Promise<CachedConversationResult | null> {
  const cacheKey = `conversation:${conversationId}`;

  // Try cache first
  const cached = await cacheGet<CachedConversation>(cacheKey);
  if (cached) {
    // Verify this profile is a participant
    const isParticipant =
      cached.profileOneId === profileId || cached.profileTwoId === profileId;

    if (!isParticipant) return null;

    return {
      conversation: cached,
      currentProfileId: profileId,
      otherProfileId:
        cached.profileOneId === profileId
          ? cached.profileTwoId
          : cached.profileOneId,
    };
  }

  // Query DB
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      profileOneId: true,
      profileTwoId: true,
      profileOne: {
        select: {
          id: true,
          username: true,
          discriminator: true,
          avatarAsset: {
            select: uploadedAssetSelect,
          },
        },
      },
      profileTwo: {
        select: {
          id: true,
          username: true,
          discriminator: true,
          avatarAsset: {
            select: uploadedAssetSelect,
          },
        },
      },
    },
  });

  if (!conversation) return null;

  // Cache the conversation
  await cacheSet(cacheKey, conversation, CACHE_TTL.MEMBER); // Same TTL as member

  // Verify this profile is a participant
  const isParticipant =
    conversation.profileOneId === profileId ||
    conversation.profileTwoId === profileId;

  if (!isParticipant) return null;

  return {
    conversation,
    currentProfileId: profileId,
    otherProfileId:
      conversation.profileOneId === profileId
        ? conversation.profileTwoId
        : conversation.profileOneId,
  };
}

/**
 * Invalidate conversation cache
 */
export async function invalidateConversationCache(
  conversationId: string,
): Promise<void> {
  await cacheDelete(`conversation:${conversationId}`);
}

// PROFILE CACHE

interface CachedProfile {
  id: string;
  username: string;
  discriminator: string;
  usernameColor: Prisma.JsonValue | null;
  profileTags: string[];
  badge: string | null;
  usernameFormat: Prisma.JsonValue | null;
  avatarAsset: {
    id: string;
    key: string;
    visibility: string;
    context: string;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
  } | null;
  badgeSticker:
    | {
        id: string;
        asset: {
          id: string;
          key: string;
          visibility: string;
          context: string;
          mimeType: string;
          sizeBytes: number | null;
          width: number | null;
          height: number | null;
          originalName: string | null;
        };
      }
    | null;
}

/**
 * Get profile with caching
 */
export async function getProfileCached(
  profileId: string,
): Promise<CachedProfile | null> {
  const cacheKey = `profile:${profileId}`;

  // Try cache first
  const cached = await cacheGet<CachedProfile>(cacheKey);
  if (cached) return cached;

  // Query DB
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: PROFILE_SELECT,
  });

  if (profile) {
    await cacheSet(cacheKey, profile, CACHE_TTL.PROFILE);
  }

  return profile;
}

/**
 * Invalidate profile cache
 */
export async function invalidateProfileCache(profileId: string): Promise<void> {
  await cacheDelete(`profile:${profileId}`);
}

// AUTH PROFILE CACHE (for authentication middleware)

interface CachedAuthProfile {
  id: string;
  userId: string;
  username: string;
  email: string;
  banned: boolean;
  bannedAt: Date | null;
  banReason: string | null;
  avatarAsset: {
    id: string;
    key: string;
    visibility: string;
    context: string;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    originalName: string | null;
  } | null;
}

/**
 * Get profile by userId with caching
 * Used in authentication middleware - called on EVERY HTTP request
 * TTL: 2 minutes (shorter for security-sensitive data like ban status)
 */
export async function getProfileByUserIdCached(
  userId: string,
): Promise<CachedAuthProfile | null> {
  const cacheKey = `auth:profile:${userId}`;

  // Try cache first
  const cached = await cacheGet<CachedAuthProfile>(cacheKey);
  if (cached) return cached;

  // Query DB
  const profile = await db.profile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      username: true,
      email: true,
      banned: true,
      bannedAt: true,
      banReason: true,
      avatarAsset: {
        select: uploadedAssetSelect,
      },
    },
  });

  if (profile) {
    // Shorter TTL (2 min) for auth data - ban status needs to propagate faster
    await cacheSet(cacheKey, profile, 120);
  }

  return profile;
}

/**
 * Invalidate auth profile cache (call when user is banned/unbanned)
 */
export async function invalidateAuthProfileCache(
  userId: string,
): Promise<void> {
  await cacheDelete(`auth:profile:${userId}`);
}

/**
 * Get profile by AuthIdentity (provider + providerUserId) with caching.
 * TTL: 2 minutes (same as userId auth cache) for ban propagation.
 */
export async function getProfileByIdentityCached(input: {
  provider: AuthProvider;
  providerUserId: string;
}): Promise<CachedAuthProfile | null> {
  const cacheKey = `auth:identity:${input.provider}:${input.providerUserId}`;

  const cached = await cacheGet<CachedAuthProfile>(cacheKey);
  if (cached) return cached;

  const identity = await db.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    select: { profileId: true },
  });

  if (!identity) {
    return null;
  }

  const profile = await db.profile.findUnique({
    where: { id: identity.profileId },
    select: {
      id: true,
      userId: true,
      username: true,
      email: true,
      banned: true,
      bannedAt: true,
      banReason: true,
      avatarAsset: {
        select: uploadedAssetSelect,
      },
    },
  });

  if (profile) {
    await cacheSet(cacheKey, profile, 120);
  }

  return profile;
}

export async function invalidateIdentityProfileCache(input: {
  provider: AuthProvider;
  providerUserId: string;
}): Promise<void> {
  await cacheDelete(`auth:identity:${input.provider}:${input.providerUserId}`);
}

// VOICE CHANNELS CACHE (for voice-get-board-participants)

interface CachedVoiceChannel {
  id: string;
}

/**
 * Get voice channel IDs for a board with caching
 * Used when fetching all voice participants for a board
 * TTL: 5 minutes - voice channels are rarely created/deleted
 */
export async function getVoiceChannelIdsCached(
  boardId: string,
): Promise<string[]> {
  const cacheKey = `voice:channels:${boardId}`;

  // Try cache first
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  // Query DB
  const channels = await db.channel.findMany({
    where: {
      boardId,
      type: "VOICE",
    },
    select: { id: true },
  });

  const channelIds = channels.map((c) => c.id);
  await cacheSet(cacheKey, channelIds, CACHE_TTL.CHANNEL);

  return channelIds;
}

/**
 * Invalidate voice channels cache for a board
 * Call when a voice channel is created or deleted
 */
export async function invalidateVoiceChannelsCache(
  boardId: string,
): Promise<void> {
  await cacheDelete(`voice:channels:${boardId}`);
}

// BULK INVALIDATION HELPERS

/**
 * Invalidate all caches for a board (when board is updated/deleted)
 */
export async function invalidateBoardCaches(boardId: string): Promise<void> {
  await cacheDeletePattern(`member:${boardId}:*`);
  await cacheDeletePattern(`channel:*`); // Channels might reference this board
  await invalidateVoiceChannelsCache(boardId);
}

export async function getProfileBoardIdsCached(profileId: string): Promise<string[]> {
  const cacheKey = `profile:${profileId}:board-ids`;
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  const members = await db.member.findMany({
    where: { profileId },
    select: { boardId: true },
  });
  const boardIds = members.map((m) => m.boardId);
  await cacheSet(cacheKey, boardIds, CACHE_TTL.PROFILE);
  return boardIds;
}

// invalidación cuando el usuario entra o sale de un board
export async function invalidateUserCaches(profileId: string): Promise<void> {
  await invalidateProfileCache(profileId);
  await cacheDeletePattern(`member:*:${profileId}`);
  await cacheDelete(`profile:${profileId}:board-ids`);
}

// CACHE STATS (for debugging/monitoring)

export async function getCacheStats(): Promise<{
  connected: boolean;
  keyCount: number;
}> {
  if (!isRedisConfigured()) {
    return { connected: false, keyCount: 0 };
  }

  try {
    const redis = getRedisClient();
    const info = await redis.dbSize();
    return { connected: true, keyCount: info };
  } catch {
    return { connected: false, keyCount: 0 };
  }
}
