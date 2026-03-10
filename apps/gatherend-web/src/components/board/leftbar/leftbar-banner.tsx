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
import { logger } from "@/lib/logger";
import { useTranslation } from "@/i18n";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";

const R2_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN || "";

interface LeftbarBannerProps {
  imageUrl?: string | null;
  boardName: string;
  boardId: string;
  board: BoardWithMembersWithProfiles;
  role?: MemberRole;
  currentProfileId: string;
}

export const LeftbarBanner = ({
  imageUrl,
  boardName,
  boardId,
  board,
  role,
  currentProfileId,
}: LeftbarBannerProps) => {
  // Solo suscribirse a acciones para evitar re-renders cuando cambia el estado global del modal/overlay.
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const onOpenOverlay = useOverlayStore(
    useCallback((state) => state.onOpen, []),
  );
  const [forceOriginalImage, setForceOriginalImage] = useState(false);
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  const isOwner = role === MemberRole.OWNER;
  const isAdmin = isOwner || role === MemberRole.ADMIN;
  const isModerator = isAdmin || role === MemberRole.MODERATOR;

  // Generar imagen automática si imageUrl está vacío - usar color consistente basado en boardId
  const finalImageUrl = getBoardImageUrl(imageUrl, boardId, boardName, 512);

  // Detectar si es Dicebear para usar quality máxima
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
        R2_DOMAIN !== "" &&
        new URL(displayImageUrl ?? "").hostname === R2_DOMAIN
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
      className="p-1.5 rounded-md bg-theme-bg-primary/50 hover:bg-theme-bg-primary/70 cursor-pointer transition text-theme-text-secondary hover:text-theme-text-secondary"
    >
      <Settings className="h-5 w-5" />
    </button>
  );

  return (
    <div className="relative w-full h-[140px] border border-t-theme-border-primary border-t-2 overflow-hidden">
      {/* Imagen de fondo - cover para Dicebear (avatars), fill para imágenes subidas */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayImageUrl ?? undefined}
        alt={boardName}
        className={`absolute inset-0 h-full w-full ${
          isDicebear ? "object-cover" : "object-fill"
        }`}
        loading="eager"
        decoding="async"
        crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
        onError={() => setForceOriginalImage(true)}
      />
      {/* Overlay gradiente superior para el botón del dropdown */}
      {/*<div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />*/}

      {/* Header superpuesto con degradado negro en la parte inferior */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <h2 className="text-md font-semibold text-white truncate drop-shadow-lg">
          {boardName}
        </h2>
      </div>

      {/* Dropdown Menu en esquina superior derecha */}
      <div className="absolute top-2 right-2 z-10">
        {!menuEnabled ? (
          triggerButtonEl
        ) : (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger className="focus:outline-none" asChild>
              {triggerButtonEl}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-theme-bg-dropdown-menu-primary border border-theme-bg-secondary text-xs text-theme-text-secondary font-medium space-y-[2px]">
              {isModerator && (
                <DropdownMenuItem
                  onClick={() => onOpen("invite", { board })}
                  className="text-theme-menu-accent-text px-3 py-2 text-sm cursor-pointer"
                >
                  {t.board.invitePeople}
                  <UserPlus className="h-4 text-theme-menu-accent-text w-4 ml-auto" />
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() =>
                    onOpenOverlay("boardSettings", {
                      board,
                      currentProfileId,
                    })
                  }
                  className="px-3 py-2 hover:bg-theme-bg-tertiary text-sm cursor-pointer"
                >
                  {t.board.boardSettings}
                  <Settings className="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              )}
              {FEATURES.CATEGORIES_ENABLED && isModerator && (
                <DropdownMenuItem
                  onClick={() => onOpen("createCategory", { board })}
                  className="px-3 py-2 hover:bg-theme-bg-tertiary text-sm cursor-pointer"
                >
                  {t.board.createCategory}
                  <PlusCircle className="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              )}
              {isModerator && (
                <DropdownMenuItem
                  onClick={() =>
                    onOpen("createChannel", { board, categoryId: null })
                  }
                  className="px-3 py-2 hover:bg-theme-bg-tertiary text-sm cursor-pointer"
                >
                  {t.board.createRoom}
                  <PlusCircle className="h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              )}
              {!isOwner && <DropdownMenuSeparator />}
              {!isOwner && (
                <DropdownMenuItem
                  onClick={() => onOpen("leaveBoard", { board })}
                  className="text-rose-500 hover:bg-theme-bg-tertiary px-3 py-2 text-sm cursor-pointer"
                >
                  {t.board.leaveBoard}
                  <LogOut className="text-rose-500 h-4 w-4 ml-auto" />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
