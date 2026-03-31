/**
 * Moderation Service
 *
 * Main entry point for content moderation. Implements 3-layer caching:
 * 1. Exact hash match (SHA-256)
 * 2. AWS Rekognition analysis
 * 3. Cache results for future lookups
 *
 * Flow:
 * Image → Hash → Cache check → Rekognition (if miss) → Cache result → Return
 */

import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  processImage,
  extractFirstFrame,
  prepareForRekognition,
  isValidImage,
} from "./image-processing.service.js";
import {
  analyzeImage,
  isRekognitionConfigured,
  getBlockedReason,
  type ModerationResult,
} from "./rekognition.service.js";
import {
  getThresholdForContext,
  type ModerationContext,
  type StrikeSeverity,
  CACHE_CONFIG,
} from "../config/moderation.config.js";

export interface ModerationResponse {
  allowed: boolean;
  reason?: string;
  userMessage?: string;
  severity?: StrikeSeverity;
  cached: boolean;
  processingTimeMs: number;
  hash: string;
}

export interface ModerateImageOptions {
  buffer: Buffer;
  context: ModerationContext;
  profileId: string;
  skipCache?: boolean;
}

/**
 * Main moderation function - call this for all image uploads
 */
export async function moderateImage(
  options: ModerateImageOptions
): Promise<ModerationResponse> {
  const { buffer, context, profileId, skipCache = false } = options;
  const startTime = Date.now();

  // Validate image
  if (!(await isValidImage(buffer))) {
    return {
      allowed: false,
      reason: "invalid_image",
      userMessage: "The uploaded file is not a valid image",
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: "",
    };
  }

  // Process image: strip EXIF, calculate hash
  const processed = await processImage(buffer);

  // Check cache first (Layer 1)
  if (!skipCache) {
    const cachedResult = await checkCache(processed.hash);
    if (cachedResult) {
      // Increment cache hits counter
      await incrementCacheHits(processed.hash);

      return {
        allowed: !cachedResult.blocked,
        reason: cachedResult.reason || undefined,
        userMessage: cachedResult.reason
          ? getBlockedReason(cachedResult.reason)
          : undefined,
        severity: cachedResult.severity as StrikeSeverity | undefined,
        cached: true,
        processingTimeMs: Date.now() - startTime,
        hash: processed.hash,
      };
    }
  }

  // Check if Rekognition is configured
  if (!isRekognitionConfigured()) {
    logger.warn("[Moderation] Rekognition not configured, allowing image");
    return {
      allowed: true,
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: processed.hash,
    };
  }

  // Get threshold based on context
  const threshold = getThresholdForContext(context);

  // Prepare image for Rekognition (resize if needed)
  const rekognitionBuffer = await prepareForRekognition(processed.buffer);

  // Call Rekognition (Layer 2)
  const result = await analyzeImage(rekognitionBuffer, threshold);

  // Cache the result (Layer 3)
  await cacheResult(processed.hash, result, context);

  // If blocked, record a strike
  if (result.blocked && result.severity) {
    await recordStrike({
      profileId,
      reason: result.reason || "unknown",
      severity: result.severity,
      contentType: getContentType(context),
      imageHash: processed.hash,
      labels: result.labels,
      confidence: result.confidence,
    });
  }

  return {
    allowed: !result.blocked,
    reason: result.reason || undefined,
    userMessage: result.reason ? getBlockedReason(result.reason) : undefined,
    severity: result.severity || undefined,
    cached: false,
    processingTimeMs: Date.now() - startTime,
    hash: processed.hash,
  };
}

/**
 * Moderate an animated sticker (extracts first frame)
 */
export async function moderateSticker(
  options: ModerateImageOptions
): Promise<ModerationResponse> {
  const { buffer, ...rest } = options;

  // Extract first frame from animated images
  const firstFrame = await extractFirstFrame(buffer);

  return moderateImage({
    ...rest,
    buffer: firstFrame,
    context: "sticker",
  });
}

/**
 * Check moderation cache by hash
 */
async function checkCache(hash: string): Promise<{
  blocked: boolean;
  reason: string | null;
  severity: string | null;
} | null> {
  try {
    const cached = await db.moderationCache.findUnique({
      where: { hash },
      select: {
        blocked: true,
        reason: true,
        severity: true,
        createdAt: true,
      },
    });

    if (!cached) return null;

    // Check if cache is still valid (TTL)
    const ageInDays =
      (Date.now() - cached.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > CACHE_CONFIG.ttlDays) {
      // Cache expired, delete it
      await db.moderationCache.delete({ where: { hash } });
      return null;
    }

    return {
      blocked: cached.blocked,
      reason: cached.reason,
      severity: cached.severity,
    };
  } catch (error) {
    logger.error("[Moderation] Cache check error:", error);
    return null;
  }
}

/**
 * Increment cache hits counter
 */
async function incrementCacheHits(hash: string): Promise<void> {
  try {
    await db.moderationCache.update({
      where: { hash },
      data: { hits: { increment: 1 } },
    });
  } catch (error) {
    // Ignore errors, this is just for analytics
  }
}

/**
 * Cache moderation result
 */
async function cacheResult(
  hash: string,
  result: ModerationResult,
  context: ModerationContext
): Promise<void> {
  try {
    await db.moderationCache.upsert({
      where: { hash },
      create: {
        hash,
        blocked: result.blocked,
        reason: result.reason,
        severity: result.severity,
        labels: result.labels as any,
        confidence: result.confidence,
        context,
      },
      update: {
        blocked: result.blocked,
        reason: result.reason,
        severity: result.severity,
        labels: result.labels as any,
        confidence: result.confidence,
        context,
      },
    });
  } catch (error) {
    logger.error("[Moderation] Cache write error:", error);
  }
}

/**
 * Record a strike against a user
 */
async function recordStrike(data: {
  profileId: string;
  reason: string;
  severity: StrikeSeverity;
  contentType: string;
  imageHash: string;
  labels: any[];
  confidence: number | null;
}): Promise<void> {
  try {
    await db.strike.create({
      data: {
        profileId: data.profileId,
        reason: data.reason,
        severity: data.severity,
        contentType: data.contentType,
        imageHash: data.imageHash,
        snapshot: { labels: data.labels, confidence: data.confidence },
      },
    });

    // TODO: Check if user should be banned based on strike count
    // await checkForBan(data.profileId);
  } catch (error) {
    logger.error("[Moderation] Strike record error:", error);
  }
}

/**
 * Get content type string from context
 */
function getContentType(context: ModerationContext): string {
  switch (context) {
    case "sticker":
      return "sticker";
    case "board_image":
    case "channel_image":
    case "community_post_image":
    case "community_post_comment_image":
    case "board_rules_image":
    case "profile_avatar":
    case "profile_banner":
      return "image";
    case "message_attachment":
    case "dm_attachment":
      return "message_image";
    default:
      return "image";
  }
}

/**
 * Get moderation stats for analytics
 */
export async function getModerationStats(): Promise<{
  totalScanned: number;
  totalBlocked: number;
  cacheHitRate: number;
  byReason: Record<string, number>;
}> {
  try {
    const [total, blocked, cacheStats] = await Promise.all([
      db.moderationCache.count(),
      db.moderationCache.count({ where: { blocked: true } }),
      db.moderationCache.aggregate({
        _sum: { hits: true },
        _count: true,
      }),
    ]);

    const byReasonRaw = await db.moderationCache.groupBy({
      by: ["reason"],
      where: { blocked: true },
      _count: true,
    });

    const byReason: Record<string, number> = {};
    for (const item of byReasonRaw) {
      if (item.reason) {
        byReason[item.reason] = item._count;
      }
    }

    const totalHits = cacheStats._sum.hits || 0;
    const totalEntries = cacheStats._count || 1;
    const cacheHitRate = totalHits / (totalHits + totalEntries);

    return {
      totalScanned: total,
      totalBlocked: blocked,
      cacheHitRate,
      byReason,
    };
  } catch (error) {
    logger.error("[Moderation] Stats error:", error);
    return {
      totalScanned: 0,
      totalBlocked: 0,
      cacheHitRate: 0,
      byReason: {},
    };
  }
}
