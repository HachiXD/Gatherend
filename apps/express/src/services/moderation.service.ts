/**
 * Main entry point for image moderation.
 *
 * Flow:
 * Image -> normalize/hash -> cache check -> NSFWJS service -> cache result -> return
 */

import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  processImage,
  isValidImage,
  prepareForModeration,
} from "./image-processing.service.js";
import {
  analyzeImage,
  isContentModerationConfigured,
} from "./content-moderation.service.js";
import {
  CACHE_CONFIG,
  getGenericBlockedMessage,
  getNsfwDecision,
  getSeverityForReason,
  MODERATION_ENGINE,
  MODERATION_POLICY_VERSION,
  type ModerationContext,
  type ModerationReason,
  type NsfwRawClasses,
  type StrikeSeverity,
} from "../config/moderation.config.js";

export interface ModerationResponse {
  allowed: boolean;
  reason?: string;
  userMessage?: string;
  severity?: StrikeSeverity;
  cached: boolean;
  processingTimeMs: number;
  hash: string;
  failureKind?: "blocked" | "service_error";
}

export interface ModerateImageOptions {
  buffer: Buffer;
  context: ModerationContext;
  profileId: string;
  skipCache?: boolean;
}

interface CachedModerationResult {
  blocked: boolean;
  reason: string | null;
  severity: string | null;
}

export async function moderateImage(
  options: ModerateImageOptions,
): Promise<ModerationResponse> {
  const { buffer, context, profileId, skipCache = false } = options;
  const startTime = Date.now();

  if (!(await isValidImage(buffer))) {
    return {
      allowed: false,
      reason: "invalid_image",
      userMessage: "The uploaded file is not a valid image.",
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: "",
      failureKind: "service_error",
    };
  }

  const processed = await processImage(buffer);

  if (!skipCache) {
    const cachedResult = await checkCache(processed.hash);
    if (cachedResult) {
      await incrementCacheHits(processed.hash);

      return {
        allowed: !cachedResult.blocked,
        reason: cachedResult.reason || undefined,
        userMessage: cachedResult.blocked
          ? getGenericBlockedMessage()
          : undefined,
        severity: cachedResult.severity as StrikeSeverity | undefined,
        cached: true,
        processingTimeMs: Date.now() - startTime,
        hash: processed.hash,
        failureKind: cachedResult.blocked ? "blocked" : undefined,
      };
    }
  }

  if (!isContentModerationConfigured()) {
    logger.warn(
      "[Moderation] CONTENT_MODERATION_URL/API_KEY not configured, failing closed",
    );
    return {
      allowed: false,
      reason: "moderation_error",
      userMessage:
        "Image moderation is currently unavailable. Please try again later.",
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: processed.hash,
      failureKind: "service_error",
    };
  }

  try {
    const prepared = await prepareForModeration(processed.buffer);
    const inference = await analyzeImage(prepared.buffer, {
      contentType: prepared.format === "png" ? "image/png" : "image/jpeg",
      filename: prepared.format === "png" ? "moderation.png" : "moderation.jpg",
    });
    const decision = getNsfwDecision(inference.classes);

    const result = {
      blocked: decision.blocked,
      reason: decision.reason,
      severity: decision.reason ? getSeverityForReason(decision.reason) : null,
      confidence: decision.confidence,
      labels: inference.classes,
    };

    await cacheResult(processed.hash, result, context);

    if (result.blocked && result.severity && result.reason) {
      await recordStrike({
        profileId,
        reason: result.reason,
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
      userMessage: result.blocked ? getGenericBlockedMessage() : undefined,
      severity: result.severity || undefined,
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: processed.hash,
      failureKind: result.blocked ? "blocked" : undefined,
    };
  } catch (error) {
    logger.error("[Moderation] NSFWJS moderation failed:", error);
    return {
      allowed: false,
      reason: "moderation_error",
      userMessage:
        "Image moderation is currently unavailable. Please try again later.",
      cached: false,
      processingTimeMs: Date.now() - startTime,
      hash: processed.hash,
      failureKind: "service_error",
    };
  }
}

export async function moderateSticker(
  options: ModerateImageOptions,
): Promise<ModerationResponse> {
  return moderateImage({
    ...options,
    context: "sticker",
  });
}

async function checkCache(
  hash: string,
): Promise<CachedModerationResult | null> {
  try {
    const cached = await db.moderationCache.findUnique({
      where: {
        hash_engine_policyVersion: {
          hash,
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      },
      select: {
        blocked: true,
        reason: true,
        severity: true,
        createdAt: true,
      },
    });

    if (!cached) return null;

    const ageInDays =
      (Date.now() - cached.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > CACHE_CONFIG.ttlDays) {
      await db.moderationCache.delete({
        where: {
          hash_engine_policyVersion: {
            hash,
            engine: MODERATION_ENGINE,
            policyVersion: MODERATION_POLICY_VERSION,
          },
        },
      });
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

async function incrementCacheHits(hash: string): Promise<void> {
  try {
    await db.moderationCache.update({
      where: {
        hash_engine_policyVersion: {
          hash,
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      },
      data: { hits: { increment: 1 } },
    });
  } catch {
    // Best effort only.
  }
}

async function cacheResult(
  hash: string,
  result: {
    blocked: boolean;
    reason: ModerationReason | null;
    severity: StrikeSeverity | null;
    labels: NsfwRawClasses;
    confidence: number | null;
  },
  context: ModerationContext,
): Promise<void> {
  try {
    await db.moderationCache.upsert({
      where: {
        hash_engine_policyVersion: {
          hash,
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      },
      create: {
        hash,
        engine: MODERATION_ENGINE,
        policyVersion: MODERATION_POLICY_VERSION,
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

async function recordStrike(data: {
  profileId: string;
  reason: ModerationReason;
  severity: StrikeSeverity;
  contentType: string;
  imageHash: string;
  labels: NsfwRawClasses;
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
        autoDetected: true,
        snapshot: {
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
          classes: data.labels,
          confidence: data.confidence,
        } as any,
      },
    });
  } catch (error) {
    logger.error("[Moderation] Strike record error:", error);
  }
}

function getContentType(context: ModerationContext): string {
  switch (context) {
    case "sticker":
      return "sticker";
    case "board_image":
    case "board_banner":
    case "channel_image":
    case "community_post_image":
    case "community_post_comment_image":
    case "board_rules_image":
    case "profile_avatar":
    case "profile_banner":
    case "profile_card_image":
    case "wiki_page_image":
      return "image";
    case "message_attachment":
    case "dm_attachment":
      return "message_image";
    default:
      return "image";
  }
}

export async function getModerationStats(): Promise<{
  totalScanned: number;
  totalBlocked: number;
  cacheHitRate: number;
  byReason: Record<string, number>;
}> {
  try {
    const [total, blocked, cacheStats] = await Promise.all([
      db.moderationCache.count({
        where: {
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      }),
      db.moderationCache.count({
        where: {
          blocked: true,
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      }),
      db.moderationCache.aggregate({
        where: {
          engine: MODERATION_ENGINE,
          policyVersion: MODERATION_POLICY_VERSION,
        },
        _sum: { hits: true },
        _count: true,
      }),
    ]);

    const byReasonRaw = await db.moderationCache.groupBy({
      by: ["reason"],
      where: {
        blocked: true,
        engine: MODERATION_ENGINE,
        policyVersion: MODERATION_POLICY_VERSION,
      },
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
