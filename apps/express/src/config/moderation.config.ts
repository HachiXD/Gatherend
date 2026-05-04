/**
 * Image moderation configuration
 *
 * Runtime moderation uses a self-hosted NSFWJS service.
 * The external service only returns raw class scores; policy lives here.
 */

import type { UploadContext } from "../../../../packages/domain/src/assets/upload-context.js";

// ModerationContext is the same contract as UploadContext — the string
// sent in the HTTP body by clients. Aliased here so internal express code
// can keep using the familiar name.
export type ModerationContext = UploadContext;

export type StrikeSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ModerationReason = "SEXY" | "PORN" | "HENTAI" | "moderation_error";
export type NsfwClassName = "Drawing" | "Hentai" | "Neutral" | "Porn" | "Sexy";

export interface NsfwThresholdConfig {
  sexy: number;
  porn: number;
  hentai: number;
}

export interface NsfwRawClasses {
  Drawing: number;
  Hentai: number;
  Neutral: number;
  Porn: number;
  Sexy: number;
}

export const NSFW_CLASS_THRESHOLDS: NsfwThresholdConfig = {
  sexy: 75,
  porn: 80,
  hentai: 80,
};

export const MODERATION_ENGINE = "nsfwjs";
export const MODERATION_POLICY_VERSION = "nsfwjs-v1";

export const STORAGE_FOLDERS: Record<ModerationContext, string> = {
  board_image: "boards",
  board_banner: "boards",
  channel_image: "channels",
  community_post_image: "community-posts",
  community_post_comment_image: "community-post-comments",
  board_rules_image: "board-rules",
  profile_avatar: "avatars",
  profile_banner: "banners",
  profile_card_image: "profile-cards",
  sticker: "stickers",
  message_attachment: "chat-attachments",
  dm_attachment: "dm-attachments",
  wiki_page_image: "wiki-pages",
};

export const CACHE_CONFIG = {
  ttlDays: 30,
};

export function getSeverityForReason(reason: ModerationReason): StrikeSeverity {
  switch (reason) {
    case "SEXY":
      return "MEDIUM";
    case "PORN":
    case "HENTAI":
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

export function getGenericBlockedMessage(): string {
  return "NSFW content is not allowed.";
}

export function getNsfwDecision(classes: NsfwRawClasses): {
  blocked: boolean;
  reason: ModerationReason | null;
  confidence: number | null;
} {
  if (classes.Porn >= NSFW_CLASS_THRESHOLDS.porn) {
    return {
      blocked: true,
      reason: "PORN",
      confidence: classes.Porn,
    };
  }

  if (classes.Hentai >= NSFW_CLASS_THRESHOLDS.hentai) {
    return {
      blocked: true,
      reason: "HENTAI",
      confidence: classes.Hentai,
    };
  }

  if (classes.Sexy >= NSFW_CLASS_THRESHOLDS.sexy) {
    return {
      blocked: true,
      reason: "SEXY",
      confidence: classes.Sexy,
    };
  }

  return {
    blocked: false,
    reason: null,
    confidence: null,
  };
}
