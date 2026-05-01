import type { BoardImageAsset } from "@/src/features/boards/types/board";

export type ClientStickerAssetRef = {
  id: string;
  name: string;
  asset: BoardImageAsset | null;
};

export type ClientProfile = {
  id: string;
  username: string;
  discriminator: string;
  reputationScore: number;
  avatarAssetId: string | null;
  bannerAssetId: string | null;
  badgeStickerId: string | null;
  profileCardConfig: unknown;
  profileCardLeftTopImageAssetId: string | null;
  profileCardLeftBottomRightTopImageAssetId: string | null;
  profileCardLeftBottomRightBottomImageAssetId: string | null;
  profileCardRightTopImageAssetId: string | null;
  profileCardRightBottomImageAssetId: string | null;
  avatarAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  profileCardLeftTopImageAsset: BoardImageAsset | null;
  profileCardLeftBottomRightTopImageAsset: BoardImageAsset | null;
  profileCardLeftBottomRightBottomImageAsset: BoardImageAsset | null;
  profileCardRightTopImageAsset: BoardImageAsset | null;
  profileCardRightBottomImageAsset: BoardImageAsset | null;
  badgeSticker: ClientStickerAssetRef | null;
  email: string;
  languages: string[];
  usernameColor: unknown;
  profileTags: string[];
  badge: string | null;
  usernameFormat: unknown;
  themeConfig: unknown;
  chatBubbleStyle: unknown;
};
