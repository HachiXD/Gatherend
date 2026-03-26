import {
  AssetContext,
  AssetVisibility,
  Prisma,
  type UploadedAsset,
} from "@prisma/client";
import { db } from "@/lib/db";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uploadedAssetSummarySelect = {
  id: true,
  key: true,
  visibility: true,
  context: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  dominantColor: true,
  originalName: true,
} satisfies Prisma.UploadedAssetSelect;

type UploadedAssetSummary = Pick<
  UploadedAsset,
  | "id"
  | "key"
  | "visibility"
  | "context"
  | "mimeType"
  | "sizeBytes"
  | "width"
  | "height"
  | "dominantColor"
  | "originalName"
>;

type StickerAssetSummary = {
  id: string;
  asset: UploadedAssetSummary | null;
};

type ProfileSummary = {
  id: string;
  username: string;
  discriminator: string | null;
  usernameColor: Prisma.JsonValue | null;
  profileTags: string[];
  badge: string | null;
  usernameFormat: Prisma.JsonValue | null;
  avatarAsset: UploadedAssetSummary | null;
  badgeSticker: StickerAssetSummary | null;
};

export function getPublicAssetUrl(key: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_CDN_URL ||
    process.env.STORAGE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_STORAGE_DOMAIN;

  if (!baseUrl) {
    throw new Error("Public asset base URL is not configured");
  }

  return `${baseUrl.replace(/\/+$/, "")}/${key}`;
}

export function serializePublicAsset(asset: UploadedAssetSummary | null) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    width: asset.width,
    height: asset.height,
    dominantColor: asset.dominantColor ?? null,
    url: getPublicAssetUrl(asset.key),
  };
}

export const serializeUploadedAsset = serializePublicAsset;

export function serializeStickerAssetRef(sticker: StickerAssetSummary | null) {
  if (!sticker) {
    return null;
  }

  return {
    id: sticker.id,
    asset: serializePublicAsset(sticker.asset),
  };
}

export function serializeProfileSummary<T extends ProfileSummary>(profile: T) {
  return {
    ...profile,
    avatarAsset: serializePublicAsset(profile.avatarAsset),
    badgeSticker: serializeStickerAssetRef(profile.badgeSticker),
  };
}

export async function loadSerializedUploadedAssetMap(
  assetIds: Array<string | null | undefined>,
) {
  const uniqueAssetIds = [...new Set(assetIds.filter(Boolean) as string[])];

  if (uniqueAssetIds.length === 0) {
    return new Map<string, ReturnType<typeof serializePublicAsset>>();
  }

  const assets = await db.uploadedAsset.findMany({
    where: {
      id: {
        in: uniqueAssetIds,
      },
    },
    select: uploadedAssetSummarySelect,
  });

  return new Map(
    assets.map((asset) => [asset.id, serializePublicAsset(asset)]),
  );
}

export async function findOwnedUploadedAsset(
  assetId: string,
  ownerProfileId: string,
  context: AssetContext,
  visibility: AssetVisibility,
) {
  return db.uploadedAsset.findFirst({
    where: {
      id: assetId,
      ownerProfileId,
      context,
      visibility,
    },
    select: uploadedAssetSummarySelect,
  });
}

export async function findOwnedSticker(stickerId: string, profileId: string) {
  return db.sticker.findFirst({
    where: {
      id: stickerId,
      uploaderId: profileId,
    },
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  });
}
