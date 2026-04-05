/**
 * Client for the self-hosted NSFWJS moderation service.
 * The external service returns raw classes only; policy is applied in express.
 */

import { logger } from "../lib/logger.js";
import type { NsfwClassName, NsfwRawClasses } from "../config/moderation.config.js";

const CONTENT_MODERATION_URL = process.env.CONTENT_MODERATION_URL || "";
const CONTENT_MODERATION_API_KEY = process.env.CONTENT_MODERATION_API_KEY || "";

export interface ContentModerationApiResult {
  ok: boolean;
  engine: string;
  classes: NsfwRawClasses;
  topClass: NsfwClassName;
  topConfidence: number;
  animated: boolean;
  analyzedFrames: number;
}

const EXPECTED_CLASS_NAMES: NsfwClassName[] = [
  "Drawing",
  "Hentai",
  "Neutral",
  "Porn",
  "Sexy",
];

function isValidClasses(input: unknown): input is NsfwRawClasses {
  if (!input || typeof input !== "object") {
    return false;
  }

  return EXPECTED_CLASS_NAMES.every((key) => {
    const value = (input as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isFinite(value);
  });
}

export async function analyzeImage(
  imageBuffer: Buffer,
  input: {
    contentType: "image/jpeg" | "image/png";
    filename?: string;
  },
): Promise<ContentModerationApiResult> {
  if (!isContentModerationConfigured()) {
    throw new Error("CONTENT_MODERATION_NOT_CONFIGURED");
  }

  try {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(imageBuffer)], {
        type: input.contentType,
      }),
      input.filename ||
        (input.contentType === "image/png" ? "upload.png" : "upload.jpg"),
    );

    const response = await fetch(`${CONTENT_MODERATION_URL}/moderate`, {
      method: "POST",
      headers: {
        "X-API-Key": CONTENT_MODERATION_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `CONTENT_MODERATION_HTTP_${response.status}${text ? `:${text}` : ""}`,
      );
    }

    const data = (await response.json()) as Partial<ContentModerationApiResult>;

    if (
      data.ok !== true ||
      data.engine !== "nsfwjs" ||
      !isValidClasses(data.classes) ||
      typeof data.topClass !== "string" ||
      typeof data.topConfidence !== "number" ||
      typeof data.animated !== "boolean" ||
      typeof data.analyzedFrames !== "number"
    ) {
      throw new Error("CONTENT_MODERATION_INVALID_RESPONSE");
    }

    return {
      ok: true,
      engine: "nsfwjs",
      classes: data.classes,
      topClass: data.topClass as NsfwClassName,
      topConfidence: data.topConfidence,
      animated: data.animated,
      analyzedFrames: data.analyzedFrames,
    };
  } catch (error) {
    logger.error("[ContentModeration] analyzeImage error:", error);
    throw error instanceof Error
      ? error
      : new Error("CONTENT_MODERATION_REQUEST_FAILED");
  }
}

export function isContentModerationConfigured(): boolean {
  return !!(CONTENT_MODERATION_URL && CONTENT_MODERATION_API_KEY);
}
