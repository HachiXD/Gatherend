"use client";

import { useState, useCallback } from "react";
import { MemberRole } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, PlusCircle, Settings, UserPlus } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { FEATURES } from "@/lib/features";
import { BoardWithMembersWithProfiles } from "../../../../types";
import { getBoardImageUrl, isDicebearUrl } from "@/lib/avatar-utils";
import { useTranslation } from "@/i18n";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const STORAGE_DOMAIN = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "";

interface LeftbarBannerProps {
  imageAsset?: ClientUploadedAsset | null;
  boardName: string;
  boardId: string;
  board: BoardWithMembersWithProfiles;
  role?: MemberRole;
  currentProfileId: string;
}

export const LeftbarBanner = ({
  imageAsset,
  boardName,
  boardId,
  board,
  role,
  currentProfileId,
}: LeftbarBannerProps) => {
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const onOpenOverlay = useOverlayStore(
    useCallback((state) => state.onOpen, []),
  );
  const [forceOriginalImage, setForceOriginalImage] = useState(false);
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  const boardImageUrl = imageAsset?.url ?? null;

  const isOwner = role === MemberRole.OWNER;
  const isAdmin = isOwner || role === MemberRole.ADMIN;
  const isModerator = isAdmin || role === MemberRole.MODERATOR;
  const menuPanelShadow =
    "shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1),inset_1px_0_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]";
  const menuRowClass =
    "h-8 cursor-pointer rounded-none border border-transparent px-3 py-2 text-sm hover:border-theme-border hover:bg-theme-bg-secondary/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)] focus:border-theme-border focus:bg-theme-bg-secondary/30 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.28)]";
  const menuDangerRowClass =
    "h-8 cursor-pointer rounded-none border border-rose-500/20 bg-rose-500/6 px-3 py-2 text-sm text-rose-400 hover:border-rose-500/35 hover:bg-rose-500/10 focus:border-rose-500/35 focus:bg-rose-500/10";

  const finalImageUrl = getBoardImageUrl(
    boardImageUrl,
    boardId,
    boardName,
    512,
  );

  const isDicebear = finalImageUrl ? isDicebearUrl(finalImageUrl) : false;
  const displayImageUrl = forceOriginalImage
    ? finalImageUrl
    : finalImageUrl
      ? getOptimizedStaticUiImageUrl(finalImageUrl, {
          w: 512,
          h: 512,
          q: 82,
          resize: "fill",
          gravity: "sm",
        })
      : null;

  const isGatherendCdnUrl = (() => {
    try {
      return (
        STORAGE_DOMAIN !== "" &&
        new URL(displayImageUrl ?? "").hostname === STORAGE_DOMAIN
      );
    } catch {
      return false;
    }
  })();

  const enableMenuOnce = useCallback(() => {
    setMenuEnabled(true);
  }, []);

  const openOnFirstInteraction = useCallback(
    (e: React.SyntheticEvent) => {
      if (menuEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuEnabled(true);
      setMenuOpen(true);
    },
    [menuEnabled],
  );

  const triggerButtonEl = (
    <button
      type="button"
      onMouseEnter={enableMenuOnce}
      onClickCapture={openOnFirstInteraction}
      onKeyDownCapture={(e) => {
        if (menuEnabled) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        openOnFirstInteraction(e);
      }}
      className="flex h-8 w-8 items-center justify-center cursor-pointer rounded-none border border-theme-border bg-theme-bg-primary/55 text-theme-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)] transition hover:bg-theme-bg-primary/72 hover:text-theme-text-secondary"
    >
      <Settings className="h-5 w-5" />
    </button>
  );

  return (
    <div className="w-full border border-t-2 border-t-theme-border-primary bg-theme-bg-secondary">
      <div className="flex items-center gap-2 border-b border-theme-border-primary px-2 py-2">
        <h2 className="min-w-0 truncate text-[18px] font-semibold text-theme-text-primary">
          {boardName}
        </h2>
        <div className="ml-auto shrink-0">
          {!menuEnabled ? (
            triggerButtonEl
          ) : (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                {triggerButtonEl}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={`w-56 rounded-none border-theme-border bg-theme-bg-dropdown-menu-primary px-1 py-0.5 text-xs font-medium text-theme-text-secondary ${menuPanelShadow}`}
              >
                {isModerator && (
                  <DropdownMenuItem
                    onClick={() => onOpen("invite", { board })}
                    className={`${menuRowClass} text-theme-menu-accent-text`}
                  >
                    {t.board.invitePeople}
                    <UserPlus className="ml-auto h-4 w-4 text-theme-menu-accent-text" />
                  </DropdownMenuItem>
                )}
                {isModerator && (
                  <DropdownMenuItem
                    onClick={() =>
                      onOpenOverlay("boardSettings", {
                        boardId,
                        currentProfileId,
                      })
                    }
                    className={menuRowClass}
                  >
                    {t.board.boardSettings}
                    <Settings className="ml-auto h-4 w-4" />
                  </DropdownMenuItem>
                )}
                {FEATURES.CATEGORIES_ENABLED && isModerator && (
                  <DropdownMenuItem
                    onClick={() => onOpen("createCategory", { board })}
                    className={menuRowClass}
                  >
                    {t.board.createCategory}
                    <PlusCircle className="ml-auto h-4 w-4" />
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() =>
                      onOpen("createChannel", { board, categoryId: null })
                    }
                    className={menuRowClass}
                  >
                    {t.board.createRoom}
                    <PlusCircle className="ml-auto h-4 w-4" />
                  </DropdownMenuItem>
                )}
                {!isOwner && (
                  <DropdownMenuSeparator className="mx-0 my-1 bg-theme-border" />
                )}
                {!isOwner && (
                  <DropdownMenuItem
                    onClick={() => onOpen("leaveBoard", { board })}
                    className={menuDangerRowClass}
                  >
                    {t.board.leaveBoard}
                    <LogOut className="ml-auto h-4 w-4 text-rose-400" />
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="p-2">
        <div className="relative h-[108px] overflow-hidden border border-theme-border-primary bg-theme-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImageUrl ?? undefined}
            alt={boardName}
            className={`h-full w-full ${
              isDicebear ? "object-cover" : "object-fill"
            }`}
            loading="eager"
            decoding="async"
            crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
            onError={() => setForceOriginalImage(true)}
          />
        </div>
      </div>
    </div>
  );
};
