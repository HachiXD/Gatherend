import express from "express";
import multer from "multer";
import crypto from "crypto";
import { AssetContext, AssetVisibility } from "@prisma/client";
import {
  uploadToStorage,
  deleteFromStorage,
  isStorageConfigured,
} from "../../lib/s3.config.js";
import { db } from "../../lib/db.js";
import { getAllStickers, getStickersByCategory } from "./stickers.service.js";
import { moderateSticker } from "../../services/moderation.service.js";
import { logger } from "../../lib/logger.js";
import {
  getSafeImageMetadata,
  looksLikeSvg,
  sniffFileType,
} from "../../lib/file-sniff.js";
import { serializeUploadedAsset } from "../../lib/uploaded-assets.js";

const router = express.Router();

const MAX_IMAGE_PIXELS = 60_000_000; // decompression bomb guard
const MAX_IMAGE_DIMENSION = 8192;

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serializeStickerResponse(sticker: {
  id: string;
  name: string;
  category: string;
  isCustom: boolean;
  uploaderId: string | null;
  createdAt: Date;
  assetId: string;
  asset: {
    id: string;
    key: string;
    width: number | null;
    height: number | null;
  } | null;
}) {
  return {
    id: sticker.id,
    name: sticker.name,
    category: sticker.category,
    isCustom: sticker.isCustom,
    uploaderId: sticker.uploaderId,
    createdAt: sticker.createdAt,
    assetId: sticker.assetId,
    asset: serializeUploadedAsset(sticker.asset),
  };
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// GET /api/stickers
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const profileId = req.profile?.id;

    const stickers = category
      ? await getStickersByCategory(category as string, profileId)
      : await getAllStickers(profileId);

    res.json(stickers);
  } catch (error) {
    logger.error("[STICKERS_GET]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

// POST /api/stickers - Upload custom sticker
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { name } = req.body;
    const file = req.file;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!file) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (looksLikeSvg(file.buffer)) {
      return res.status(400).json({ error: "SVG uploads are not allowed" });
    }

    const sniffed = sniffFileType(file.buffer);
    if (!sniffed || sniffed.kind !== "image") {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    // Decompression bomb / oversized dimensions guard
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    try {
      const metadata = await getSafeImageMetadata({
        buffer: file.buffer,
        maxPixels: MAX_IMAGE_PIXELS,
        maxDimension: MAX_IMAGE_DIMENSION,
      });

      imageWidth = metadata.width;
      imageHeight = metadata.height;
    } catch {
      return res.status(400).json({ error: "Invalid or oversized image" });
    }

    // Check limit: 10 stickers per user
    const userStickersCount = await db.sticker.count({
      where: { uploaderId: profileId },
    });

    if (userStickersCount >= 10) {
      return res.status(403).json({
        error: "Limit reached",
        message: "You can only upload up to 10 custom stickers.",
      });
    }

    // Moderate sticker before uploading
    const moderationResult = await moderateSticker({
      buffer: file.buffer,
      context: "sticker",
      profileId,
    });

    if (!moderationResult.allowed) {
      return res.status(400).json({
        error: "Content not allowed",
        message:
          moderationResult.userMessage ||
          "This sticker violates our content guidelines.",
        moderation: {
          reason: moderationResult.reason,
          cached: moderationResult.cached,
        },
      });
    }

    // Check R2 configuration
    if (!isStorageConfigured()) {
      logger.error("[STICKERS] Storage not configured");
      return res.status(500).json({ error: "Storage not configured" });
    }

    // Upload to storage
    const ext = sniffed.ext;
    const uniqueKey = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const result = await uploadToStorage({
      buffer: file.buffer,
      key: uniqueKey,
      contentType: sniffed.mime,
      folder: "stickers",
    });

    if (!result.success) {
      logger.error("[STICKERS] Storage upload failed:", result.error);
      return res.status(500).json({ error: "Failed to upload sticker" });
    }

    const sticker = await db.$transaction(async (tx) => {
      const asset = await tx.uploadedAsset.create({
        data: {
          key: result.key,
          visibility: AssetVisibility.PUBLIC,
          context: AssetContext.STICKER_IMAGE,
          mimeType: sniffed.mime,
          sizeBytes: file.size,
          width: imageWidth,
          height: imageHeight,
          originalName: file.originalname || null,
          ownerProfileId: profileId,
        },
        select: {
          id: true,
          key: true,
          width: true,
          height: true,
        },
      });

      return tx.sticker.create({
        data: {
          name: name || "Custom Sticker",
          assetId: asset.id,
          category: "custom",
          isCustom: true,
          uploaderId: profileId,
        },
        select: {
          id: true,
          name: true,
          category: true,
          isCustom: true,
          uploaderId: true,
          createdAt: true,
          assetId: true,
          asset: {
            select: {
              id: true,
              key: true,
              width: true,
              height: true,
            },
          },
        },
      });
    });

    res.json(serializeStickerResponse(sticker));
  } catch (error) {
    logger.error("[STICKERS_POST]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE /api/stickers/:id
router.delete("/:id", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { id } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Invalid sticker ID" });
    }

    const sticker = await db.sticker.findUnique({
      where: { id },
      select: {
        id: true,
        uploaderId: true,
        assetId: true,
      },
    });

    if (!sticker) {
      return res.status(404).json({ error: "Sticker not found" });
    }

    // Verify ownership
    if (sticker.uploaderId !== profileId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Check if sticker is used in any messages
    const messagesWithSticker = await db.message.count({
      where: { stickerId: id },
    });
    const directMessagesWithSticker = await db.directMessage.count({
      where: { stickerId: id },
    });

    const isUsedInMessages =
      messagesWithSticker > 0 || directMessagesWithSticker > 0;

    if (isUsedInMessages) {
      // Sticker is used in messages - just remove from user's collection
      // by setting uploaderId to null (keeps sticker for existing messages)
      await db.sticker.update({
        where: { id },
        data: { uploaderId: null },
      });
    } else {
      const deletedAssetKey = await db.$transaction(async (tx) => {
        await tx.sticker.delete({
          where: { id },
        });

        const otherStickerUsingAsset = await tx.sticker.findFirst({
          where: {
            assetId: sticker.assetId,
          },
          select: { id: true },
        });

        if (otherStickerUsingAsset) {
          return null;
        }

        const asset = await tx.uploadedAsset.findUnique({
          where: { id: sticker.assetId },
          select: { key: true },
        });

        if (!asset) {
          return null;
        }

        await tx.uploadedAsset.delete({
          where: { id: sticker.assetId },
        });

        return asset.key;
      });

      if (deletedAssetKey) {
        await deleteFromStorage(deletedAssetKey);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error("[STICKERS_DELETE]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

// POST /api/stickers/:id/clone - Clone sticker to user's collection
router.post("/:id/clone", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { id } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Invalid sticker ID" });
    }

    // Check if sticker exists
    const originalSticker = await db.sticker.findUnique({
      where: { id },
    });

    if (!originalSticker) {
      return res.status(404).json({ error: "Sticker not found" });
    }

    // Check if user already has this sticker
    const existingClone = await db.sticker.findFirst({
      where: {
        uploaderId: profileId,
        assetId: originalSticker.assetId,
        name: originalSticker.name,
      },
    });

    if (existingClone) {
      return res.status(409).json({
        error: "Already in collection",
        message: "You already have this sticker in your collection.",
      });
    }

    // Check limit: 10 stickers per user
    const userStickersCount = await db.sticker.count({
      where: { uploaderId: profileId },
    });

    if (userStickersCount >= 10) {
      return res.status(403).json({
        error: "Limit reached",
        message: "Delete a sticker to get space! (Max: 10 custom stickers)",
      });
    }

    // Clone the sticker
    const clonedSticker = await db.sticker.create({
      data: {
        name: originalSticker.name,
        assetId: originalSticker.assetId,
        category: "custom",
        isCustom: true,
        uploaderId: profileId,
      },
      select: {
        id: true,
        name: true,
        category: true,
        isCustom: true,
        uploaderId: true,
        createdAt: true,
        assetId: true,
        asset: {
          select: {
            id: true,
            key: true,
            width: true,
            height: true,
          },
        },
      },
    });

    res.json(serializeStickerResponse(clonedSticker));
  } catch (error) {
    logger.error("[STICKERS_CLONE]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
