"use client";

import { useOverlayStore } from "@/hooks/use-overlay-store";
import { BoardSettingsOverlay } from "../overlays/board-settings/board-settings-overlay";
import { UserSettingsOverlay } from "../overlays/user-settings/user-settings-overlay";
import { ProfileSettingsOverlay } from "../overlays/profile-settings/profile-settings-overlay";

export const OverlayProvider = () => {
  const { type, isOpen, data, onClose } = useOverlayStore();

  return (
    <>
      {type === "boardSettings" && isOpen && (
        <BoardSettingsOverlay
          board={data.board!}
          currentProfileId={data.currentProfileId}
          onClose={onClose}
        />
      )}

      {type === "userSettings" && isOpen && (
        <UserSettingsOverlay user={data.user!} onClose={onClose} />
      )}

      {type === "profileSettings" && isOpen && (
        <ProfileSettingsOverlay user={data.user!} onClose={onClose} />
      )}
    </>
  );
};
