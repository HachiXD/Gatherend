import express from "express";
import multer from "multer";
import crypto from "crypto";
import { AssetContext, AssetVisibility } from "@prisma/client";
import {
  uploadToStorage,
  isStorageConfigured,
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
  STORAGE_FOLDERS,
} from "../../config/moderation.config.js";
import { logger } from "../../lib/logger.js";
import { db } from "../../lib/db.js";
import { extractDominantColor } from "../../lib/color-extraction.js";

const router = express.Router();

const MAX_IMAGE_PIXELS = 60_000_000; // decompression bomb guard
const MAX_IMAGE_DIMENSION = 8192;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

interface UploadResponse {
  success: boolean;
  assetId?: string;
  url?: string;
  storage?: "s3";
  mimeType?: string;
  originalName?: string;
  sizeBytes?: number;
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

const ALWAYS_MODERATED_CONTEXTS: ModerationContext[] = [
  "board_image",
  "channel_image",
  "community_post_image",
  "community_post_comment_image",
  "board_rules_image",
  "profile_avatar",
  "profile_banner",
  "sticker",
];

function requiresAlwaysOnModeration(context: ModerationContext): boolean {
  return ALWAYS_MODERATED_CONTEXTS.includes(context);
}

const CONTEXT_TO_ASSET_CONTEXT: Record<ModerationContext, AssetContext> = {
  board_image: AssetContext.BOARD_IMAGE,
  channel_image: AssetContext.CHANNEL_IMAGE,
  community_post_image: AssetContext.COMMUNITY_POST_IMAGE,
  community_post_comment_image: AssetContext.COMMUNITY_POST_COMMENT_IMAGE,
  board_rules_image: AssetContext.BOARD_RULES_IMAGE,
  profile_avatar: AssetContext.PROFILE_AVATAR,
  profile_banner: AssetContext.PROFILE_BANNER,
  message_attachment: AssetContext.MESSAGE_ATTACHMENT,
  dm_attachment: AssetContext.DM_ATTACHMENT,
  sticker: AssetContext.STICKER_IMAGE,
};

router.post("/", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    const profileId = req.profile?.id;
    const context = req.body.context as ModerationContext;
    const boardIdRaw = req.body.boardId;
    const file = req.file;

    if (!profileId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing profile ID",
      } as UploadResponse);
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      } as UploadResponse);
    }

    if (!context || !STORAGE_FOLDERS[context]) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid or missing context. Valid values: " +
          Object.keys(STORAGE_FOLDERS).join(", "),
      } as UploadResponse);
    }

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

    const isChatContext =
      context === "message_attachment" || context === "dm_attachment";
    if (sniffed.kind === "pdf" && !isChatContext) {
      return res.status(400).json({
        success: false,
        error: "PDF uploads are only allowed for chat attachments",
      } as UploadResponse);
    }

    if (!isStorageConfigured()) {
      logger.error("[Upload] Storage not configured");
      return res.status(500).json({
        success: false,
        error: "Storage not configured",
      } as UploadResponse);
    }

    let moderationResult: ModerationResponse | null = null;
    let scopedBoardId: string | null = null;
    let shouldModerateUpload = requiresAlwaysOnModeration(context);

    if (context === "message_attachment") {
      if (typeof boardIdRaw !== "string" || !UUID_REGEX.test(boardIdRaw)) {
        return res.status(400).json({
          success: false,
          error: "message_attachment uploads require a valid boardId",
        } as UploadResponse);
      }

      const board = await db.board.findFirst({
        where: {
          id: boardIdRaw,
          members: {
            some: {
              profileId,
            },
          },
        },
        select: {
          id: true,
          isPrivate: true,
        },
      });

      if (!board) {
        return res.status(404).json({
          success: false,
          error: "Board not found",
        } as UploadResponse);
      }

      scopedBoardId = board.id;
      shouldModerateUpload = !board.isPrivate;
    } else if (context === "dm_attachment" && boardIdRaw !== undefined) {
      return res.status(400).json({
        success: false,
        error: "dm_attachment uploads cannot include boardId",
      } as UploadResponse);
    }

    if (shouldModerateUpload && sniffed.kind === "image") {
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

      if (!moderationResult.allowed) {
        if (moderationResult.failureKind === "service_error") {
          return res.status(503).json({
            success: false,
            error:
              moderationResult.userMessage ||
              "Image moderation is currently unavailable. Please try again later.",
          } as UploadResponse);
        }

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

    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    let dominantColor: string | null = null;

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

      try {
        dominantColor = await extractDominantColor(file.buffer);
      } catch {
        // non-critical
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

    const visibility = isPrivateAttachment
      ? AssetVisibility.PRIVATE
      : AssetVisibility.PUBLIC;
    const assetContext = CONTEXT_TO_ASSET_CONTEXT[context];

    const asset = await db.uploadedAsset.create({
      data: {
        key: storageResult.key,
        visibility,
        context: assetContext,
        mimeType: sniffed.mime,
        sizeBytes: file.size,
        width: imageWidth,
        height: imageHeight,
        dominantColor,
        originalName: file.originalname || null,
        ownerProfileId: profileId,
        boardId: context === "message_attachment" ? scopedBoardId : null,
      },
      select: {
        id: true,
      },
    });

    const response: UploadResponse = {
      success: true,
      assetId: asset.id,
      url: responseUrl,
      storage: "s3",
      mimeType: sniffed.mime,
      originalName: file.originalname || undefined,
      sizeBytes: file.size,
      ...(imageWidth !== null && imageHeight !== null
        ? { width: imageWidth, height: imageHeight }
        : {}),
    };

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
