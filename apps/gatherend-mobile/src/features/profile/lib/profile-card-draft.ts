import type { BoardImageAsset } from "@/src/features/boards/types/board";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";
import type { UploadedFile } from "@/src/features/uploads/domain/uploaded-file";
import type { ProfileCardConfig } from "@/src/features/profile/lib/profile-card-config";

// ----- Types -----

export type ProfileCardImageSlot =
  | "leftTopImage"
  | "leftBottomRightTopImage"
  | "leftBottomRightBottomImage"
  | "rightTopImage"
  | "rightBottomImage";

export interface ProfileCardImageSlotValue {
  assetId: string | null;
  asset: BoardImageAsset | null;
}

export interface ProfileCardEditorDraft {
  style: {
    backgroundColor: string;
    boxColor: string;
    rounded: boolean;
    shadows: boolean;
  };
  content: {
    pageTitle: string;
    leftTopTextTitle: string;
    leftTopTextContent: string;
    sectionATitle: string;
    sectionAContent: string;
    sectionBTitle: string;
    sectionBContent: string;
    rightTopImageTitle: string;
    rightBottomImageTitle: string;
  };
  images: Record<ProfileCardImageSlot, ProfileCardImageSlotValue>;
}

// ----- Constants -----

const DEFAULT_PROFILE_CARD_STYLE = {
  backgroundColor: "#707070",
  boxColor: "#8a8a8a",
  rounded: false,
  shadows: true,
} as const;

// ----- Helpers -----

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build a BoardImageAsset from the result of a successful upload.
 * This is the mobile equivalent of web's `createUploadedAssetFromUpload`.
 */
export function createBoardImageAssetFromUpload(
  file: UploadedFile,
): BoardImageAsset {
  return {
    id: file.assetId,
    url: file.url,
    width: file.width ?? null,
    height: file.height ?? null,
    dominantColor: null,
  };
}

// ----- Draft initialization -----

export function createInitialProfileCardDraft(
  profile: ClientProfile,
): ProfileCardEditorDraft {
  const config = profile.profileCardConfig as ProfileCardConfig | null | undefined;

  return {
    style: {
      backgroundColor:
        config?.style?.backgroundColor ?? DEFAULT_PROFILE_CARD_STYLE.backgroundColor,
      boxColor: config?.style?.boxColor ?? DEFAULT_PROFILE_CARD_STYLE.boxColor,
      rounded: config?.style?.rounded ?? DEFAULT_PROFILE_CARD_STYLE.rounded,
      shadows: config?.style?.shadows ?? DEFAULT_PROFILE_CARD_STYLE.shadows,
    },
    content: {
      pageTitle: config?.content?.pageTitle ?? "",
      leftTopTextTitle: config?.content?.leftTopText?.title ?? "",
      leftTopTextContent: config?.content?.leftTopText?.content ?? "",
      sectionATitle: config?.content?.leftBottomText?.sectionA?.title ?? "",
      sectionAContent: config?.content?.leftBottomText?.sectionA?.content ?? "",
      sectionBTitle: config?.content?.leftBottomText?.sectionB?.title ?? "",
      sectionBContent: config?.content?.leftBottomText?.sectionB?.content ?? "",
      rightTopImageTitle: config?.content?.rightTopImage?.title ?? "",
      rightBottomImageTitle: config?.content?.rightBottomImage?.title ?? "",
    },
    images: {
      leftTopImage: {
        assetId: profile.profileCardLeftTopImageAssetId,
        asset: profile.profileCardLeftTopImageAsset as BoardImageAsset | null,
      },
      leftBottomRightTopImage: {
        assetId: profile.profileCardLeftBottomRightTopImageAssetId,
        asset: profile.profileCardLeftBottomRightTopImageAsset as BoardImageAsset | null,
      },
      leftBottomRightBottomImage: {
        assetId: profile.profileCardLeftBottomRightBottomImageAssetId,
        asset: profile.profileCardLeftBottomRightBottomImageAsset as BoardImageAsset | null,
      },
      rightTopImage: {
        assetId: profile.profileCardRightTopImageAssetId,
        asset: profile.profileCardRightTopImageAsset as BoardImageAsset | null,
      },
      rightBottomImage: {
        assetId: profile.profileCardRightBottomImageAssetId,
        asset: profile.profileCardRightBottomImageAsset as BoardImageAsset | null,
      },
    },
  };
}

// ----- Draft → payload -----

export function buildProfileCardConfigFromDraft(draft: ProfileCardEditorDraft): {
  config: ProfileCardConfig;
  error: string | null;
} {
  const pageTitle = trimToNull(draft.content.pageTitle);
  const leftTopTextTitle = trimToNull(draft.content.leftTopTextTitle);
  const leftTopTextContent = trimToNull(draft.content.leftTopTextContent);
  const sectionATitle = trimToNull(draft.content.sectionATitle);
  const sectionAContent = trimToNull(draft.content.sectionAContent);
  const sectionBTitle = trimToNull(draft.content.sectionBTitle);
  const sectionBContent = trimToNull(draft.content.sectionBContent);
  const rightTopImageTitle = trimToNull(draft.content.rightTopImageTitle);
  const rightBottomImageTitle = trimToNull(draft.content.rightBottomImageTitle);

  const emptyConfig: ProfileCardConfig = {
    version: 1,
    style: { ...draft.style },
    content: {},
  };

  if (leftTopTextTitle && !leftTopTextContent) {
    return { config: emptyConfig, error: "leftTopText needs content before you save a title." };
  }

  if (Boolean(sectionATitle) !== Boolean(sectionAContent)) {
    return { config: emptyConfig, error: "Section A needs both title and content." };
  }

  if (Boolean(sectionBTitle) !== Boolean(sectionBContent)) {
    return { config: emptyConfig, error: "Section B needs both title and content." };
  }

  if (rightTopImageTitle && !draft.images.rightTopImage.assetId) {
    return { config: emptyConfig, error: "rightTopImage needs an uploaded image before adding a title." };
  }

  if (rightBottomImageTitle && !draft.images.rightBottomImage.assetId) {
    return { config: emptyConfig, error: "rightBottomImage needs an uploaded image before adding a title." };
  }

  return {
    config: {
      version: 1,
      style: {
        backgroundColor: draft.style.backgroundColor,
        boxColor: draft.style.boxColor,
        rounded: draft.style.rounded,
        shadows: draft.style.shadows,
      },
      content: {
        ...(pageTitle ? { pageTitle } : {}),
        ...(leftTopTextContent
          ? {
              leftTopText: {
                content: leftTopTextContent,
                ...(leftTopTextTitle ? { title: leftTopTextTitle } : {}),
              },
            }
          : {}),
        ...((sectionATitle && sectionAContent) || (sectionBTitle && sectionBContent)
          ? {
              leftBottomText: {
                ...(sectionATitle && sectionAContent
                  ? { sectionA: { title: sectionATitle, content: sectionAContent } }
                  : {}),
                ...(sectionBTitle && sectionBContent
                  ? { sectionB: { title: sectionBTitle, content: sectionBContent } }
                  : {}),
              },
            }
          : {}),
        ...(rightTopImageTitle ? { rightTopImage: { title: rightTopImageTitle } } : {}),
        ...(rightBottomImageTitle ? { rightBottomImage: { title: rightBottomImageTitle } } : {}),
      },
    },
    error: null,
  };
}
