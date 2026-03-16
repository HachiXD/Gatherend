"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Board, Member, Profile } from "@prisma/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

import { GeneralTab } from "@/components/overlays/board-settings/tabs/general";
import { MembersTab } from "@/components/overlays/board-settings/tabs/members";
import { BansTab } from "@/components/overlays/board-settings/tabs/bans";
import { DangerZoneTab } from "@/components/overlays/board-settings/tabs/danger-zone";
import { SettingsSidebar } from "@/components/overlays/board-settings/sidebar";

interface BoardSettingsOverlayProps {
  board: Board & {
    imageAsset?: ClientUploadedAsset | null;
    members: (Member & {
      profile: Pick<
        Profile,
        "id" | "username" | "discriminator" | "email" | "userId"
      > & {
        avatarAsset: ClientUploadedAsset | null;
        badgeSticker: ClientStickerAssetRef | null;
      };
    })[];
  };
  currentProfileId?: string;
  onClose: () => void;
}

export const BoardSettingsOverlay = ({
  board,
  currentProfileId,
  onClose,
}: BoardSettingsOverlayProps) => {
  const [tab, setTab] = useState<"general" | "members" | "bans" | "danger">(
    "general"
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain pointer-events-auto">
      <div
        className={cn(
          "relative bg-theme-bg-overlay-primary w-full max-w-4xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-3rem)]",
          "rounded-lg shadow-2xl flex flex-col sm:flex-row overflow-hidden animate-in fade-in zoom-in duration-150"
        )}
      >
        {/* SIDEBAR */}
        <SettingsSidebar tab={tab} setTab={setTab} onClose={onClose} />

        {/* MAIN PANEL */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {tab === "general" && <GeneralTab board={board} />}
          {tab === "members" && (
            <MembersTab board={board} currentProfileId={currentProfileId} />
          )}
          {tab === "bans" && <BansTab boardId={board.id} />}
          {tab === "danger" && <DangerZoneTab board={board} />}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-white/10 transition"
        >
          <X className="w-5 h-5 text-theme-text-subtle" />
        </button>
      </div>
    </div>,
    document.body
  );
};
