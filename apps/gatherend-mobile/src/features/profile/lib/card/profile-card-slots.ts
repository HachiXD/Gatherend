import type { ProfileCardConfig } from "./profile-card-config";

export interface ProfileCardAssetLike {
  id?: string | null;
  url?: string | null;
}

export interface ProfileCardLayoutInput {
  profileCardConfig?: ProfileCardConfig | null;
  profileCardLeftTopImageAsset?: ProfileCardAssetLike | null;
  profileCardLeftBottomRightTopImageAsset?: ProfileCardAssetLike | null;
  profileCardLeftBottomRightBottomImageAsset?: ProfileCardAssetLike | null;
  profileCardRightTopImageAsset?: ProfileCardAssetLike | null;
  profileCardRightBottomImageAsset?: ProfileCardAssetLike | null;
}

export const PROFILE_CARD_IMAGE_SLOT_KEYS = [
  "leftTopImage",
  "leftBottomRightTopImage",
  "leftBottomRightBottomImage",
  "rightTopImage",
  "rightBottomImage",
] as const;

export const PROFILE_CARD_TEXT_SLOT_KEYS = [
  "leftTopText",
  "leftBottomTextSectionA",
  "leftBottomTextSectionB",
] as const;

export const PROFILE_CARD_BODY_LEAF_KEYS = [
  ...PROFILE_CARD_IMAGE_SLOT_KEYS,
  ...PROFILE_CARD_TEXT_SLOT_KEYS,
] as const;

export type ProfileCardImageSlotKey =
  (typeof PROFILE_CARD_IMAGE_SLOT_KEYS)[number];

export type ProfileCardTextSlotKey =
  (typeof PROFILE_CARD_TEXT_SLOT_KEYS)[number];

export type ProfileCardLeafKey = (typeof PROFILE_CARD_BODY_LEAF_KEYS)[number];

export interface ActiveProfileCardSlots {
  pageTitle: boolean;
  leftTopImage: boolean;
  leftTopText: boolean;
  leftBottomTextSectionA: boolean;
  leftBottomTextSectionB: boolean;
  leftBottomRightTopImage: boolean;
  leftBottomRightBottomImage: boolean;
  rightTopImage: boolean;
  rightBottomImage: boolean;
  bottomTextColumn: boolean;
  bottomImagesColumn: boolean;
  topRow: boolean;
  bottomRow: boolean;
  rightRow: boolean;
  mainBody: boolean;
  activeLeafCount: number;
  activeLeafIds: ProfileCardLeafKey[];
}

function hasTrimmedText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRenderableAsset(asset: ProfileCardAssetLike | null | undefined) {
  return !!asset && (Boolean(asset.id) || Boolean(asset.url));
}

export function getProfileCardActiveSlots(
  input: ProfileCardLayoutInput,
): ActiveProfileCardSlots {
  const content = input.profileCardConfig?.content;

  const leftTopImage = hasRenderableAsset(input.profileCardLeftTopImageAsset);
  const leftTopText = hasTrimmedText(content?.leftTopText?.content);
  const leftBottomTextSectionA =
    hasTrimmedText(content?.leftBottomText?.sectionA?.title) &&
    hasTrimmedText(content?.leftBottomText?.sectionA?.content);
  const leftBottomTextSectionB =
    hasTrimmedText(content?.leftBottomText?.sectionB?.title) &&
    hasTrimmedText(content?.leftBottomText?.sectionB?.content);
  const leftBottomRightTopImage = hasRenderableAsset(
    input.profileCardLeftBottomRightTopImageAsset,
  );
  const leftBottomRightBottomImage = hasRenderableAsset(
    input.profileCardLeftBottomRightBottomImageAsset,
  );
  const rightTopImage = hasRenderableAsset(input.profileCardRightTopImageAsset);
  const rightBottomImage = hasRenderableAsset(
    input.profileCardRightBottomImageAsset,
  );

  const activeLeafIds = PROFILE_CARD_BODY_LEAF_KEYS.filter((slotKey) => {
    switch (slotKey) {
      case "leftTopImage":
        return leftTopImage;
      case "leftTopText":
        return leftTopText;
      case "leftBottomTextSectionA":
        return leftBottomTextSectionA;
      case "leftBottomTextSectionB":
        return leftBottomTextSectionB;
      case "leftBottomRightTopImage":
        return leftBottomRightTopImage;
      case "leftBottomRightBottomImage":
        return leftBottomRightBottomImage;
      case "rightTopImage":
        return rightTopImage;
      case "rightBottomImage":
        return rightBottomImage;
      default:
        return false;
    }
  });

  const bottomTextColumn = leftBottomTextSectionA || leftBottomTextSectionB;
  const bottomImagesColumn =
    leftBottomRightTopImage || leftBottomRightBottomImage;
  const topRow = leftTopImage || leftTopText;
  const bottomRow = bottomTextColumn || bottomImagesColumn;
  const rightRow = rightTopImage || rightBottomImage;
  const mainBody = topRow || bottomRow || rightRow;

  return {
    pageTitle: hasTrimmedText(content?.pageTitle ?? null),
    leftTopImage,
    leftTopText,
    leftBottomTextSectionA,
    leftBottomTextSectionB,
    leftBottomRightTopImage,
    leftBottomRightBottomImage,
    rightTopImage,
    rightBottomImage,
    bottomTextColumn,
    bottomImagesColumn,
    topRow,
    bottomRow,
    rightRow,
    mainBody,
    activeLeafCount: activeLeafIds.length,
    activeLeafIds,
  };
}
