"use client";

import { Languages } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  memo,
  useState,
  useTransition,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { getBoardImageUrl } from "@/lib/avatar-utils";
import { getDerivedColors } from "@/lib/color-extraction";
import { useUserBoards } from "@/hooks/use-user-boards";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useModal } from "@/hooks/use-modal-store";
import { Siren } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useTranslation } from "@/i18n";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface DiscoveryBoardCardProps {
  board: {
    id: string;
    name: string;
    description: string | null;
    imageAsset: ClientUploadedAsset | null;
    size: number;
    occupiedSlots: number;
    freeSlots: number;
    languages: Languages[];
  };
}

function DiscoveryBoardCardComponent({ board }: DiscoveryBoardCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: userBoards } = useUserBoards();
  const { data: currentProfile } = useCurrentProfile();
  const { onOpen } = useModal();
  const [isPending, startTransition] = useTransition();
  const [isJoining, setIsJoining] = useState(false);
  const [isHoveringJoin, setIsHoveringJoin] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { t } = useTranslation();

  // Ref for setTimeout cleanup to prevent memory leak on unmount
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SPA Navigation context
  const boardSwitch = useBoardSwitchSafe();

  // Verificar si el usuario ya es miembro de este board
  const isMember = useMemo(() => {
    return userBoards?.some((b) => b.id === board.id) ?? false;
  }, [userBoards, board.id]);

  // Generar imagen automática si no hay una - usar color consistente basado en board.id
  const finalImageUrl = getBoardImageUrl(
    board.imageAsset?.url || null,
    board.id,
    board.name,
    256,
  );

  const displayImageUrl = useMemo(() => {
    if (!finalImageUrl) return null;
    // Discovery board header: never animate even if the original is animated.
    return getNeverAnimatedImageUrl(finalImageUrl, { w: 1024, h: 512, q: 82 });
  }, [finalImageUrl]);

  // Use Web Worker for color extraction (eliminates hidden img and main thread blocking)
  const { dominantColor, handleImageLoad } = useColorExtraction({
    imageUrl: displayImageUrl || finalImageUrl,
  });

  // Colores derivados del color dominante
  const derivedColors = getDerivedColors(dominantColor || "#1F2D2C");

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (invalidateTimeoutRef.current) {
        clearTimeout(invalidateTimeoutRef.current);
      }
    };
  }, []);

  const handleJoin = async () => {
    if (isJoining || isPending) return;

    // Si ya es miembro, navegar directamente (BoardView redirige al main channel)
    if (isMember) {
      startTransition(() => {
        if (boardSwitch?.isClientNavigationEnabled) {
          boardSwitch.switchBoard(board.id);
        } else {
          router.push(`/boards/${board.id}`);
        }
      });
      return;
    }

    // Si no es miembro, hacer join via API
    try {
      setIsJoining(true);
      const response = await axios.post(
        `/api/boards/${board.id}/join?source=discovery`,
      );

      // Si se unió exitosamente, navegar con SPA
      if (response.data.success || response.data.alreadyMember) {
        // Invalidar queries primero para que el board aparezca en user-boards
        await queryClient.invalidateQueries({ queryKey: ["user-boards"] });
        await queryClient.invalidateQueries({ queryKey: ["board", board.id] });

        startTransition(() => {
          if (boardSwitch?.isClientNavigationEnabled) {
            // Navegar al board, BoardView se encargará de redirigir al primer canal
            boardSwitch.switchBoard(board.id);
          } else {
            router.push(`/boards/${board.id}`);
          }
        });

        // Invalidar discovery en background (no es crítico)
        // Use ref to allow cleanup on unmount
        invalidateTimeoutRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["discovery"] });
        }, 1000);
      }
    } catch (error) {
      console.error("Error joining board:", error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      data-board-id={board.id}
      className={cn(
        "border-t-1 border-r-2 border-b-2 overflow-hidden",
        "shadow-md hover:shadow-xl transition-all duration-300",
        "w-full h-fit flex flex-col group",
      )}
      style={{
        backgroundColor: dominantColor || "#1F2D2C",
        borderTopColor: derivedColors.reliefBorderLight,
        borderRightColor: derivedColors.reliefBorder,
        borderBottomColor: derivedColors.reliefBorder,
      }}
    >
      {/* TITLE */}
      <div className="px-3 py-2">
        <h3 className="text-white font-bold text-lg tracking-tight drop-shadow-md line-clamp-2 break-words">
          {board.name}
        </h3>
      </div>

      {/* HEADER IMAGE */}
      <div className="relative w-full h-[120px] overflow-hidden">
        {displayImageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt={board.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="eager"
            decoding="async"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white/70 bg-black/10">
            {board.name?.charAt(0).toUpperCase()}
          </div>
        )}

        {/* FADE OVERLAY */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />

        {/* REPORT BUTTON - esquina superior derecha */}
        <div className="absolute top-2 right-2 z-10">
          <ActionTooltip label={t.discovery.reportBoard} side="left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen("reportBoard", {
                  reportBoardId: board.id,
                  reportBoardName: board.name,
                  reportBoardDescription: board.description,
                  reportBoardImageUrl: board.imageAsset?.url || null,
                  profileId: currentProfile?.id,
                });
              }}
              className="cursor-pointer border bg-black/50 p-1.5 text-white/70 transition-colors hover:bg-red-500/30 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 rounded-none border-[color:var(--report-border)]"
              style={
                {
                  "--report-border": derivedColors.reliefBorderLight,
                } as React.CSSProperties
              }
            >
              <Siren className="h-4 w-4" />
            </button>
          </ActionTooltip>
        </div>
      </div>

      {/* BODY */}
      <div className="px-3 pb-4 pt-2 flex flex-col gap-2.5">
        {/* DESCRIPTION - Scrollable con altura máxima */}
        <div
          className="w-[calc(100%+8px)] max-h-[140px] overflow-y-auto scrollbar-ultra-thin -mr-2"
          style={
            {
              "--scrollbar-card-thumb": derivedColors.scrollbarThumb,
              "--scrollbar-card-thumb-hover": derivedColors.scrollbarThumbHover,
            } as React.CSSProperties
          }
        >
          <p className="text-neutral-200/90 text-sm whitespace-pre-line break-words leading-relaxed font-medium">
            {board.description || t.discovery.noDescriptionAvailable}
          </p>
        </div>

        {/* INFO + JOIN */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
          {/* MEMBERS / SIZE */}
          <div
            className="px-2 py-0.5 text-[19px] font-semibold transition-colors shadow-sm"
            style={{
              backgroundColor: derivedColors.badgeBg,
              color: derivedColors.badgeText,
              borderWidth: 1,
              borderColor: derivedColors.badgeBorder,
            }}
          >
            {board.occupiedSlots}/{board.size}
          </div>

          {/* JOIN BUTTON */}
          <button
            onClick={handleJoin}
            onMouseEnter={() => setIsHoveringJoin(true)}
            onMouseLeave={() => setIsHoveringJoin(false)}
            disabled={isJoining || isPending}
            className={cn(
              "px-4 py-1.5 text-[15px] font-semibold transition-all shadow-md",
              "active:scale-[0.96] cursor-pointer",
              (isJoining || isPending) && "opacity-50 cursor-not-allowed",
            )}
            style={{
              backgroundColor: isHoveringJoin
                ? derivedColors.buttonHoverBg
                : derivedColors.buttonBg,
              color: derivedColors.buttonText,
            }}
          >
            {isJoining ? t.discovery.joining : t.discovery.join}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DiscoveryBoardCard = memo(DiscoveryBoardCardComponent);
