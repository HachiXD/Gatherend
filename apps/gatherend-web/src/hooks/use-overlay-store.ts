"use client";

import { Board, Member } from "@prisma/client";
import { create } from "zustand";
import { useMobileDrawerStore } from "@/stores/mobile-drawer-store";
import type { ClientProfile } from "@/hooks/use-current-profile";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

type OverlayType = "boardSettings" | "userSettings" | "profileSettings" | null;

interface OverlayData {
  // Puedes poner cualquier cosa aquí según tus overlays
  board?: Board & {
    members: (Member & {
      profile: Pick<ClientProfile, "id" | "username" | "discriminator"> & {
        avatarAsset: ClientUploadedAsset | null;
        badgeSticker: ClientStickerAssetRef | null;
      };
    })[];
  };
  user?: ClientProfile;
  currentProfileId?: string;
}

interface OverlayStore {
  type: OverlayType;
  data: OverlayData;
  isOpen: boolean;
  onOpen: (type: OverlayType, data?: OverlayData) => void;
  onClose: () => void;
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,

  onOpen: (type, data = {}) =>
    set(() => {
      useMobileDrawerStore.getState().closeAll();

      return {
        type,
        data,
        isOpen: true,
      };
    }),

  onClose: () =>
    set({
      type: null,
      data: {},
      isOpen: false,
    }),
}));
