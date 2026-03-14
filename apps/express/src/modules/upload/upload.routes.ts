/**
 * Upload Routes
 *
 * Unified upload endpoint that:
 * 1. Receives file via multer
 * 2. Moderates public content (Rekognition) - boards, avatars, stickers
 * 3. Skips moderation for private content - chat/DM attachments
 * 4. Uploads everything to S3-compatible storage
 * 5. Returns URL or error
 *
 * CSAM scanning is handled at the Cloudflare proxy level.
 */

import express from "express";
import multer from "multer";
import crypto from "crypto";
import {
  uploadToStorage,
  isStorageConfigured,
  type StorageUploadResult,
} from "../../lib/s3.config.js";
import { getSignedAttachmentsUrl } from "../../lib/attachments-gateway.js";
import {
  getSafeImageMetadata,
  looksLikeSvg,
  sniffFileType,
} from "../../lib/file-sniff.js";
import {
  moderateImage,
  moderateSticker,
  type ModerationResponse,
} from "../../services/moderation.service.js";
import {
  type ModerationContext,
  CONTEXT_THRESHOLD_MAP,
  STORAGE_FOLDERS,
} from "../../config/moderation.config.js";
import { logger } from "../../lib/logger.js";

const router = express.Router();

const MAX_IMAGE_PIXELS = 60_000_000; // decompression bomb guard
const MAX_IMAGE_DIMENSION = 8192;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else if (file.mimetype === "application/pdf") {
      // PDFs are allowed only for private chat contexts (validated later).
      cb(null, true);
    } else {
      cb(new Error("Only images and PDFs are allowed"));
    }
  },
});

// TYPES

interface UploadResponse {
  success: boolean;
  url?: string;
  key?: string;
  storage?: "s3";
  width?: number;
  height?: number;
  error?: string;
  moderation?: {
    allowed: boolean;
    reason?: string;
    cached: boolean;
    processingTimeMs: number;
  };
}

// CONTEXT CONFIGURATION

// Contexts that require moderation (public content)
const MODERATED_CONTEXTS: ModerationContext[] = [
  "board_image",
  "community_post_image",
  "board_description",
  "profile_avatar",
  "profile_banner",
  "sticker",
];

// Check if context requires moderation
function requiresModeration(context: ModerationContext): boolean {
  return MODERATED_CONTEXTS.includes(context);
}

// MAIN UPLOAD ENDPOINT

/**
 * POST /api/upload
 *
 * Body (multipart/form-data):
 * - image: File
 * - context: ModerationContext ('board_image', 'profile_avatar', etc.)
 *
 * Authentication: Handled by authenticateRequest middleware (req.profile)
 */
router.post("/", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    const profileId = req.profile?.id;
    const context = req.body.context as ModerationContext;
    const file = req.file;

    // Validate auth
    if (!profileId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing profile ID",
      } as UploadResponse);
    }

    // Validate file
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      } as UploadResponse);
    }

    // Validate context
    if (!context || !STORAGE_FOLDERS[context]) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid or missing context. Valid values: " +
          Object.keys(STORAGE_FOLDERS).join(", "),
      } as UploadResponse);
    }

    // Content sniffing (do not trust browser mimetype)
    if (looksLikeSvg(file.buffer)) {
      return res.status(400).json({
        success: false,
        error: "SVG uploads are not allowed",
      } as UploadResponse);
    }

    const sniffed = sniffFileType(file.buffer);
    if (!sniffed) {
      return res.status(400).json({
        success: false,
        error: "Unsupported file type",
      } as UploadResponse);
    }

    // Context rules:
    // - PDFs are allowed only for private attachments in chats/DMs.
    const isChatContext =
      context === "message_attachment" || context === "dm_attachment";
    if (sniffed.kind === "pdf" && !isChatContext) {
      return res.status(400).json({
        success: false,
        error: "PDF uploads are only allowed for chat attachments",
      } as UploadResponse);
    }

    // Check storage configuration
    if (!isStorageConfigured()) {
      logger.error("[Upload] Storage not configured");
      return res.status(500).json({
        success: false,
        error: "Storage not configured",
      } as UploadResponse);
    }

    // MODERATION (only for public content)

    let moderationResult: ModerationResponse | null = null;

    if (requiresModeration(context) && sniffed.kind === "image") {
      // Moderate public content with Rekognition
      if (context === "sticker") {
        moderationResult = await moderateSticker({
          buffer: file.buffer,
          context,
          profileId,
        });
      } else {
        moderationResult = await moderateImage({
          buffer: file.buffer,
          context,
          profileId,
        });
      }

      // Block if moderation failed
      if (!moderationResult.allowed) {
        return res.status(400).json({
          success: false,
          error: moderationResult.userMessage || "Content not allowed",
          moderation: {
            allowed: false,
            reason: moderationResult.reason,
            cached: moderationResult.cached,
            processingTimeMs: moderationResult.processingTimeMs,
          },
        } as UploadResponse);
      }
    }

    // UPLOAD

    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    if (sniffed.kind === "image") {
      try {
        const safeMeta = await getSafeImageMetadata({
          buffer: file.buffer,
          maxPixels: MAX_IMAGE_PIXELS,
          maxDimension: MAX_IMAGE_DIMENSION,
        });

        imageWidth = safeMeta.width;
        imageHeight = safeMeta.height;
      } catch (err) {
        logger.warn("[Upload] Failed to read image metadata", {
          profileId,
          context,
          mimetype: file.mimetype,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const ext = sniffed.ext;
    const uniqueKey = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const folder = STORAGE_FOLDERS[context];

    const isPrivateAttachment =
      context === "message_attachment" || context === "dm_attachment";
    const attachmentsBucket = process.env.ATTACHMENTS_BUCKET_NAME?.trim();

    if (isPrivateAttachment && !attachmentsBucket) {
      logger.error(
        "[Upload] Private attachments requested but ATTACHMENTS_BUCKET_NAME is not set",
      );
      return res.status(500).json({
        success: false,
        error: "Attachments bucket misconfigured",
      } as UploadResponse);
    }

    const storageResult = await uploadToStorage({
      buffer: file.buffer,
      key: uniqueKey,
      contentType: sniffed.mime,
      folder,
      ...(isPrivateAttachment && attachmentsBucket
        ? { bucketName: attachmentsBucket }
        : {}),
      ...(sniffed.kind === "pdf" ? { contentDisposition: "attachment" } : {}),
    });

    if (!storageResult.success) {
      logger.error("[Upload] Storage upload failed:", storageResult.error);
      return res.status(500).json({
        success: false,
        error: "Failed to upload file",
      } as UploadResponse);
    }

    // Build response
    // For private attachments we return a signed gateway URL (don't persist this URL; persist storageResult.key).
    let responseUrl = storageResult.url;
    if (isPrivateAttachment && attachmentsBucket) {
      try {
        responseUrl = getSignedAttachmentsUrl(storageResult.key);
      } catch (e) {
        logger.error(
          "[Upload] Attachments gateway signing misconfigured (missing ATTACHMENTS_HMAC_KEY?)",
          e,
        );
        return res.status(500).json({
          success: false,
          error: "Attachments gateway misconfigured",
        } as UploadResponse);
      }
    }

    const response: UploadResponse = {
      success: true,
      url: responseUrl,
      key: storageResult.key,
      storage: "s3",
      ...(imageWidth !== null && imageHeight !== null
        ? { width: imageWidth, height: imageHeight }
        : {}),
    };

    // Include moderation info if applicable
    if (moderationResult) {
      response.moderation = {
        allowed: true,
        cached: moderationResult.cached,
        processingTimeMs: moderationResult.processingTimeMs,
      };
    }

    return res.json(response);
  } catch (error) {
    logger.error("[Upload] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    } as UploadResponse);
  }
});

export default router;
