import { db } from "../../lib/db.js";
import { getStoragePublicUrl } from "../../lib/s3.config.js";

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

type MinimalPublicAsset = {
  id: string;
  key: string;
  width: number | null;
  height: number | null;
};

function serializePublicAsset(asset: MinimalPublicAsset | null) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    width: asset.width,
    height: asset.height,
    url: getStoragePublicUrl(asset.key),
  };
}

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
  } | null;
}) {
  return {
    id: sticker.id,
    name: sticker.name,
    category: sticker.category,
    uploaderId: sticker.uploaderId,
    isCustom: sticker.isCustom,
    createdAt: sticker.createdAt,
    assetId: sticker.assetId,
    asset: serializePublicAsset(sticker.asset),
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
