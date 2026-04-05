import {
  AssetContext,
  AssetVisibility,
  Prisma,
  type UploadedAsset,
} from "@prisma/client";
import { db } from "./db.js";
import { getStoragePublicUrl } from "./s3.config.js";
import { getSignedAttachmentsUrl } from "./attachments-gateway.js";

export const uploadedAssetSelect = {
  id: true,
  key: true,
  visibility: true,
  context: true,
  boardId: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  dominantColor: true,
  originalName: true,
} satisfies Prisma.UploadedAssetSelect;

export const stickerSelect = {
  id: true,
  name: true,
  category: true,
  asset: {
    select: uploadedAssetSelect,
  },
} as const;

export const profileSelect = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSelect,
      },
    },
  },
} as const;

type UploadedAssetSummary = Pick<
  UploadedAsset,
  | "id"
  | "key"
  | "visibility"
  | "context"
  | "boardId"
  | "mimeType"
  | "sizeBytes"
  | "width"
  | "height"
  | "dominantColor"
  | "originalName"
>;

export function serializeUploadedAsset(asset: UploadedAssetSummary | null) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    width: asset.width,
    height: asset.height,
    dominantColor: asset.dominantColor ?? null,
    url: getStoragePublicUrl(asset.key),
  };
}

export function serializeAttachmentAsset(asset: UploadedAssetSummary | null) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    originalName: asset.originalName,
    url: getSignedAttachmentsUrl(asset.key),
  };
}

export function serializeSticker(
  sticker:
    | {
        id: string;
        name: string;
        category: string;
        asset: UploadedAssetSummary;
      }
    | null
    | undefined,
) {
  if (!sticker) {
    return null;
  }

  return {
    id: sticker.id,
    name: sticker.name,
    category: sticker.category,
    asset: serializeUploadedAsset(sticker.asset),
  };
}

export function serializeProfile<
  T extends {
    avatarAsset: UploadedAssetSummary | null;
    badgeSticker:
      | {
          id: string;
          asset: UploadedAssetSummary;
        }
      | null;
  },
>(profile: T) {
  return {
    ...profile,
    avatarAsset: serializeUploadedAsset(profile.avatarAsset),
    badgeSticker: profile.badgeSticker
      ? {
          id: profile.badgeSticker.id,
          asset: serializeUploadedAsset(profile.badgeSticker.asset),
        }
      : null,
  };
}

export async function findOwnedUploadedAsset(input: {
  assetId: string;
  ownerProfileId: string;
  context: AssetContext;
  visibility: AssetVisibility;
  boardId?: string | null;
}) {
  const { assetId, ownerProfileId, context, visibility, boardId } = input;

  return db.uploadedAsset.findFirst({
    where: {
      id: assetId,
      ownerProfileId,
      context,
      visibility,
      ...(boardId !== undefined ? { boardId } : {}),
    },
    select: uploadedAssetSelect,
  });
}
