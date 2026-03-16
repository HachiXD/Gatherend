import { db } from "../../lib/db.js";
import { serializeUploadedAsset } from "../../lib/uploaded-assets.js";

const stickerSelect = {
  id: true,
  name: true,
  category: true,
  uploaderId: true,
  isCustom: true,
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
} as const;

function serializeSticker(sticker: {
  id: string;
  name: string;
  category: string;
  uploaderId: string | null;
  isCustom: boolean;
  createdAt: Date;
  assetId: string;
  asset: {
    id: string;
    key: string;
    width: number | null;
    height: number | null;
  };
}) {
  return {
    id: sticker.id,
    name: sticker.name,
    category: sticker.category,
    uploaderId: sticker.uploaderId,
    isCustom: sticker.isCustom,
    createdAt: sticker.createdAt,
    assetId: sticker.assetId,
    asset: serializeUploadedAsset(sticker.asset),
  };
}

export async function getAllStickers(profileId?: string) {
  const stickers = await db.sticker.findMany({
    where: {
      OR: [
        { isCustom: false },
        ...(profileId ? [{ uploaderId: profileId, isCustom: true }] : []),
      ],
    },
    select: stickerSelect,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return stickers.map(serializeSticker);
}

export async function getStickersByCategory(
  category: string,
  profileId?: string
) {
  const stickers = await db.sticker.findMany({
    where: {
      category,
      OR: [
        { isCustom: false },
        ...(profileId ? [{ uploaderId: profileId, isCustom: true }] : []),
      ],
    },
    select: stickerSelect,
    orderBy: { name: "asc" },
  });

  return stickers.map(serializeSticker);
}

export async function getStickerById(id: string) {
  const sticker = await db.sticker.findUnique({
    where: { id },
    select: stickerSelect,
  });

  return sticker ? serializeSticker(sticker) : null;
}
