/**
 * Moderation Configuration
 *
 * Defines thresholds and rules for content moderation using AWS Rekognition.
 *
 * Two contexts:
 * - STRICT: Public content (discovery boards, avatars, board images)
 * - PERMISSIVE: Private content (chat messages, DMs, stickers)
 */

export type ModerationContext =
  | "board_image"
  | "channel_image"
  | "community_post_image"
  | "community_post_comment_image"
  | "board_rules_image"
  | "profile_avatar"
  | "profile_banner"
  | "message_attachment"
  | "sticker"
  | "dm_attachment";

export type ThresholdType = "strict" | "permissive";

export interface ThresholdConfig {
  minConfidence: number;
  blockLabels: string[];
  labelThresholds: Record<string, number>;
}

// REKOGNITION THRESHOLDS

// NudeNet labels (replaces AWS Rekognition)
export const NUDENET_THRESHOLDS: Record<ThresholdType, ThresholdConfig> = {
  /**
   * STRICT: Feed público, discovery boards, avatares
   * Bloquea: Genitales expuestos, pechos femeninos, ano
   * Permite: Contenido cubierto, pies, vientre, axilas
   */
  strict: {
    minConfidence: 45, // NudeNet uses 0-1 scale, we convert to 0-100

    blockLabels: [
      // NudeNet explicit labels - BLOCKED
      "MALE_GENITALIA_EXPOSED",
      "FEMALE_GENITALIA_EXPOSED",
      "FEMALE_BREAST_EXPOSED",
      "BUTTOCKS_EXPOSED",
      "ANUS_EXPOSED",

      // Permitido (no bloqueado):
      // FEMALE_GENITALIA_COVERED, FEMALE_BREAST_COVERED
      // BUTTOCKS_COVERED, MALE_GENITALIA_COVERED
      // BELLY_EXPOSED, FEET_EXPOSED, ARMPITS_EXPOSED
      // FACE_FEMALE, FACE_MALE, MALE_BREAST_EXPOSED
    ],

    labelThresholds: {
      MALE_GENITALIA_EXPOSED: 40,
      FEMALE_GENITALIA_EXPOSED: 40,
      FEMALE_BREAST_EXPOSED: 50,
      BUTTOCKS_EXPOSED: 45,
      ANUS_EXPOSED: 40,
    },
  },

  /**
   * PERMISSIVE: Chats privados (grupos y DMs)
   * Bloquea: Solo genitales explícitos
   * Permite: Pechos, glúteos, etc.
   */
  permissive: {
    minConfidence: 50,

    blockLabels: [
      // Solo genitales explícitos - BLOCKED
      "MALE_GENITALIA_EXPOSED",
      "FEMALE_GENITALIA_EXPOSED",
      "ANUS_EXPOSED",

      // Permitido en chats privados:
      // FEMALE_BREAST_EXPOSED, BUTTOCKS_EXPOSED
    ],

    labelThresholds: {
      MALE_GENITALIA_EXPOSED: 45,
      FEMALE_GENITALIA_EXPOSED: 45,
      ANUS_EXPOSED: 50,
    },
  },
};

// Backwards compatibility alias
export const REKOGNITION_THRESHOLDS = NUDENET_THRESHOLDS;

// CONTEXT → THRESHOLD MAPPING

export const CONTEXT_THRESHOLD_MAP: Record<ModerationContext, ThresholdType> = {
  // Público - Strict (goes to Cloudinary)
  board_image: "strict",
  channel_image: "strict",
  community_post_image: "strict",
  community_post_comment_image: "strict",
  board_rules_image: "strict",
  profile_avatar: "strict",
  profile_banner: "strict",
  sticker: "strict", // Stickers use Cloudinary with strict

  // Privado - Permissive (goes to S3)
  message_attachment: "permissive",
  dm_attachment: "permissive",
};

// STORAGE BACKEND MAPPING

export type StorageBackend = "s3";

export const CONTEXT_STORAGE_MAP: Record<ModerationContext, StorageBackend> = {
  board_image: "s3",
  channel_image: "s3",
  community_post_image: "s3",
  community_post_comment_image: "s3",
  board_rules_image: "s3",
  profile_avatar: "s3",
  profile_banner: "s3",
  sticker: "s3",
  message_attachment: "s3",
  dm_attachment: "s3",
};

export const STORAGE_FOLDERS: Record<ModerationContext, string> = {
  board_image: "boards",
  channel_image: "channels",
  community_post_image: "community-posts",
  community_post_comment_image: "community-post-comments",
  board_rules_image: "board-rules",
  profile_avatar: "avatars",
  profile_banner: "banners",
  sticker: "stickers",
  message_attachment: "chat-attachments",
  dm_attachment: "dm-attachments",
};

// STRIKE SEVERITY MAPPING
// Only for labels that are actually blocked

export type StrikeSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const LABEL_SEVERITY_MAP: Record<string, StrikeSeverity> = {
  MALE_GENITALIA_EXPOSED: "HIGH",
  FEMALE_GENITALIA_EXPOSED: "HIGH",
  ANUS_EXPOSED: "HIGH",

  FEMALE_BREAST_EXPOSED: "MEDIUM",
  BUTTOCKS_EXPOSED: "MEDIUM",
};

// STRIKE RULES

export const STRIKE_RULES: Record<
  StrikeSeverity,
  { maxStrikes: number; banDuration?: number }
> = {
  CRITICAL: { maxStrikes: 1 }, // Instant permanent ban
  HIGH: { maxStrikes: 2 }, // 2 strikes = ban
  MEDIUM: { maxStrikes: 3 }, // 3 strikes = ban
  LOW: { maxStrikes: 5 }, // 5 strikes = ban
};

// CACHE CONFIGURATION

export const CACHE_CONFIG = {
  // How long to keep moderation results cached (30 days)
  ttlDays: 30,

  // Perceptual hash similarity threshold (0-1, lower = more similar)
  pHashSimilarityThreshold: 0.1,
};

// HELPER FUNCTIONS

export function getThresholdForContext(
  context: ModerationContext,
): ThresholdConfig {
  const thresholdType = CONTEXT_THRESHOLD_MAP[context];
  return REKOGNITION_THRESHOLDS[thresholdType];
}

export function getSeverityForLabel(label: string): StrikeSeverity {
  return LABEL_SEVERITY_MAP[label] || "MEDIUM";
}
