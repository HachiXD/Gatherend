/**
 * Redis Client for Next.js App
 *
 * Uses the same Redis instance as Express server.
 * Used for:
 * - Caching community feed rankings
 * - Other caching needs
 */

import { createClient, RedisClientType } from "redis";

// Singleton Redis client
let redis: RedisClientType | null = null;
let isConnecting = false;

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Get Redis client (lazy initialization)
 */
export async function getRedis(): Promise<RedisClientType | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  if (redis?.isOpen) {
    return redis;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait a bit and try again
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getRedis();
  }

  try {
    isConnecting = true;

    redis = createClient({
      url: process.env.REDIS_URL,
    });

    redis.on("error", (err) => {
      console.error("[REDIS] Client error:", err);
    });

    await redis.connect();

    return redis;
  } catch (error) {
    console.error("[REDIS] Connection failed:", error);
    redis = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Cache helpers for community feed
 */
export const communityFeedCache = {
  CACHE_PREFIX: "communities:feed:",
  MAX_CACHED_PAGES: 10,
  TTL_SECONDS: 120, // 2 min fallback TTL (cron invalidates every 1 min)

  /**
   * Get cache key for a page
   */
  getPageKey(pageNumber: number): string {
    return `${this.CACHE_PREFIX}page:${pageNumber}`;
  },

  /**
   * Get cached page
   */
  async getPage<T>(pageNumber: number): Promise<T | null> {
    if (pageNumber > this.MAX_CACHED_PAGES) {
      return null;
    }

    try {
      const client = await getRedis();
      if (!client) return null;

      const cached = await client.get(this.getPageKey(pageNumber));
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error("[REDIS] Error getting cached page:", error);
      return null;
    }
  },

  /**
   * Set cached page
   */
  async setPage<T>(pageNumber: number, data: T): Promise<void> {
    if (pageNumber > this.MAX_CACHED_PAGES) {
      return;
    }

    try {
      const client = await getRedis();
      if (!client) return;

      await client.setEx(
        this.getPageKey(pageNumber),
        this.TTL_SECONDS,
        JSON.stringify(data),
      );
    } catch (error) {
      console.error("[REDIS] Error setting cached page:", error);
    }
  },

  /**
   * Invalidate all cached pages (called by cron after ranking update)
   */
  async invalidateAll(): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      // Delete all cached pages
      const keys: string[] = [];
      for (let i = 1; i <= this.MAX_CACHED_PAGES; i++) {
        keys.push(this.getPageKey(i));
      }

      if (keys.length > 0) {
        await client.del(keys);
      }

    } catch (error) {
      console.error("[REDIS] Error invalidating cache:", error);
    }
  },
};

/**
 * Cache helpers for user profile (replaces Prisma Accelerate)
 * Used by currentProfile() for fast auth checks
 */
export const profileCache = {
  CACHE_PREFIX: "profile:cache:",
  TTL_SECONDS: 300, // 5 minutes - invalidated explicitly on profile changes

  /**
   * Get cache key for a user
   */
  getKey(userId: string): string {
    return `${this.CACHE_PREFIX}${userId}`;
  },

  /**
   * Get cached profile
   */
  async get<T>(userId: string): Promise<T | null> {
    try {
      const client = await getRedis();
      if (!client) return null;

      const cached = await client.get(this.getKey(userId));
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error("[REDIS] Error getting cached profile:", error);
      return null;
    }
  },

  /**
   * Set cached profile
   */
  async set<T>(userId: string, data: T): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.setEx(
        this.getKey(userId),
        this.TTL_SECONDS,
        JSON.stringify(data),
      );
    } catch (error) {
      console.error("[REDIS] Error setting cached profile:", error);
    }
  },

  /**
   * Invalidate cached profile (call on ban/unban)
   */
  async invalidate(userId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(userId));
    } catch (error) {
      console.error("[REDIS] Error invalidating profile cache:", error);
    }
  },
};

/**
 * Cache helpers for Express membership snapshots.
 * Next invalidates these keys after membership mutations because both apps
 * share the same Redis instance in production.
 */
export const expressMemberCache = {
  getKey(boardId: string, profileId: string): string {
    return `member:${boardId}:${profileId}`;
  },

  async invalidate(boardId: string, profileId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(boardId, profileId));
    } catch (error) {
      console.error("[REDIS] Error invalidating express member cache:", error);
    }
  },

  async invalidateMany(boardId: string, profileIds: string[]): Promise<void> {
    try {
      const client = await getRedis();
      if (!client || profileIds.length === 0) return;

      await client.del(
        profileIds.map((profileId) => this.getKey(boardId, profileId)),
      );
    } catch (error) {
      console.error("[REDIS] Error invalidating express member caches:", error);
    }
  },

  async invalidateByProfileId(profileId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      const keys = await client.keys(`member:*:${profileId}`);
      if (keys.length === 0) return;

      await client.del(keys);
    } catch (error) {
      console.error(
        "[REDIS] Error invalidating express member caches by profile:",
        error,
      );
    }
  },
};

export const expressProfileCache = {
  getKey(profileId: string): string {
    return `profile:${profileId}`;
  },

  async invalidate(profileId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(profileId));
    } catch (error) {
      console.error("[REDIS] Error invalidating express profile cache:", error);
    }
  },
};

export const expressAuthProfileCache = {
  getKey(userId: string): string {
    return `auth:profile:${userId}`;
  },

  async invalidate(userId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(userId));
    } catch (error) {
      console.error(
        "[REDIS] Error invalidating express auth profile cache:",
        error,
      );
    }
  },
};

export const expressIdentityProfileCache = {
  getKey(provider: string, providerUserId: string): string {
    return `auth:identity:${provider}:${providerUserId}`;
  },

  async invalidate(provider: string, providerUserId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(provider, providerUserId));
    } catch (error) {
      console.error(
        "[REDIS] Error invalidating express identity profile cache:",
        error,
      );
    }
  },

  async invalidateMany(
    identities: Array<{ provider: string; providerUserId: string }>,
  ): Promise<void> {
    try {
      const client = await getRedis();
      if (!client || identities.length === 0) return;

      await client.del(
        identities.map((identity) =>
          this.getKey(identity.provider, identity.providerUserId),
        ),
      );
    } catch (error) {
      console.error(
        "[REDIS] Error invalidating express identity profile caches:",
        error,
      );
    }
  },
};

export const expressChannelCache = {
  getKey(channelId: string): string {
    return `channel:${channelId}`;
  },

  async invalidateMany(channelIds: string[]): Promise<void> {
    try {
      const client = await getRedis();
      if (!client || channelIds.length === 0) return;

      await client.del(channelIds.map((channelId) => this.getKey(channelId)));
    } catch (error) {
      console.error("[REDIS] Error invalidating express channel caches:", error);
    }
  },
};

export const expressVoiceChannelsCache = {
  getKey(boardId: string): string {
    return `voice:channels:${boardId}`;
  },

  async invalidate(boardId: string): Promise<void> {
    try {
      const client = await getRedis();
      if (!client) return;

      await client.del(this.getKey(boardId));
    } catch (error) {
      console.error(
        "[REDIS] Error invalidating express voice channels cache:",
        error,
      );
    }
  },
};
