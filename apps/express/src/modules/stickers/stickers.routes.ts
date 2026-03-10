import express from "express";
import multer from "multer";
import crypto from "crypto";
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

const router = express.Router();

const MAX_IMAGE_PIXELS = 60_000_000; // decompression bomb guard
const MAX_IMAGE_DIMENSION = 8192;

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    try {
      await getSafeImageMetadata({
        buffer: file.buffer,
        maxPixels: MAX_IMAGE_PIXELS,
        maxDimension: MAX_IMAGE_DIMENSION,
      });
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

    // Save to DB (using publicId field to store R2 key for backwards compat)
    const sticker = await db.sticker.create({
      data: {
        name: name || "Custom Sticker",
        imageUrl: result.url,
        category: "custom",
        isCustom: true,
        uploaderId: profileId,
        publicId: result.key,
      },
    });

    res.json(sticker);
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
      // Sticker is not used anywhere - safe to delete completely
      // Delete from storage if it has publicId
      if (sticker.publicId) {
        await deleteFromStorage(sticker.publicId);
      }

      // Delete from DB
      await db.sticker.delete({
        where: { id },
      });
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
        imageUrl: originalSticker.imageUrl,
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
        imageUrl: originalSticker.imageUrl,
        category: "custom",
        isCustom: true,
        uploaderId: profileId,
        // Don't copy publicId - we don't own the Cloudinary asset
      },
    });

    res.json(clonedSticker);
  } catch (error) {
    logger.error("[STICKERS_CLONE]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
