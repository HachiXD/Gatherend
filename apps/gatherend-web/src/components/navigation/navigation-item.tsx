"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";
import { useNavigationStore } from "@/hooks/use-navigation-store";
import { resolveLastBoardViewForBoard } from "@/contexts/board-switch-context";
import { AtSign } from "lucide-react";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
import type { BoardWithData } from "@/lib/boards/board-types";
import type { BoardViewTarget } from "@/lib/navigation/navigation-types";

const STORAGE_DOMAIN = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "";

interface NavigationItemProps {
  id: string;
  boardImageUrl: string | null;
  imageAsset?: ClientUploadedAsset | null;
  name: string;
  channelIds: string[];
  /** Si este board está activo. Pasado como prop desde NavigationSidebar
   *  para evitar que cada item se suscriba al contexto completo.
   *  Cuando isActive cambia, solo 2 items re-renderizan (el anterior y el nuevo activo).
   *  Opcional para compatibilidad con el server component NavigationSidebar. */
  isActive?: boolean;
}

// Helper para comparar arrays de strings
const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const NavigationItemComponent = ({
  id,
  boardImageUrl,
  imageAsset: _imageAsset,
  name,
  channelIds,
  isActive = false,
}: NavigationItemProps) => {
  const router = useRouter();

  // OPTIMIZACIÓN: Selector de Zustand - solo re-renderiza cuando cambian SUS canales
  const hasUnreads = useUnreadStore(
    useCallback(
      (state) => channelIds.some((channelId) => state.unreads[channelId] > 0),
      [channelIds],
    ),
  );

  const hasMentions = useMentionStore(
    useCallback(
      (state) =>
        channelIds.some((channelId) => state.mentions[channelId] === true),
      [channelIds],
    ),
  );

  // OPTIMIZACIÓN: Zustand con selector estable — switchBoard es referencia estable (useCallback(fn, []))
  // Solo re-renderiza si la referencia de switchBoard cambia (prácticamente nunca)
  const switchBoard = useNavigationStore(
    useCallback((state) => state.switchBoard, []),
  );
  const switchBoardView = useNavigationStore(
    useCallback((state) => state.switchBoardView, []),
  );
  const isNavigationReady = switchBoard !== null;

  const queryClient = useQueryClient();
  const [isNavigating, setIsNavigating] = useState(false);

  // Detectar si es Dicebear para usar quality máxima
  const [forceOriginalImage, setForceOriginalImage] = useState(false);

  const displayImageUrl = useMemo(() => {
    if (!boardImageUrl) return null;
    if (forceOriginalImage) return boardImageUrl;
    return getOptimizedStaticUiImageUrl(boardImageUrl, {
      w: 96,
      h: 96,
      q: 82,
      resize: "fill",
      gravity: "sm",
    });
  }, [forceOriginalImage, boardImageUrl]);

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

  const fallbackLabel = useMemo(
    () => name.trim().charAt(0).toUpperCase() || "?",
    [name],
  );

  // OPTIMIZACIÓN EXTREMA: visualContent es 100% estático respecto a isActive/hasUnreads/hasMentions
  // Usamos data-attributes + CSS (Tailwind data-*) para estilos condicionales.
  // Esto significa que visualContent mantiene la MISMA referencia cuando cambia isActive,
  // por lo que ActionTooltip NO re-renderiza su árbol interno de Tooltip/Popper.
  //
  // Los indicadores siempre se renderizan pero se ocultan con CSS cuando no aplican.
  // Esto es mejor para reconciliación de React (misma estructura JSX = misma referencia).
  const visualContent = useMemo(
    () => (
      <div className="relative">
        <div
          className={cn(
            "relative flex h-12 w-13 rounded-2xl cursor-pointer items-center justify-center overflow-hidden border border-theme-border-secondary/70 bg-theme-bg-tertiary/70 transition-all",
            displayImageUrl
              ? "shadow-[0_-1px_0_rgba(255,255,255,0.22),-1px_0_0_rgba(255,255,255,0.14),1px_0_0_rgba(0,0,0,0.40),0_1px_0_rgba(0,0,0,0.55)]"
              : "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            "hover:border-theme-border hover:ring-2 hover:ring-theme-border-accent-active-channel",
            "group-data-[active=true]/item:border-theme-border group-data-[active=true]/item:ring-2 group-data-[active=true]/item:ring-theme-border-accent-active-channel",
            "group-data-[navigating=true]/item:animate-pulse group-data-[navigating=true]/item:opacity-70",
          )}
        >
          {displayImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayImageUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover rounded-2xl"
              loading="eager"
              decoding="async"
              crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
              onError={() => setForceOriginalImage(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-theme-bg-tertiary text-[13px] font-semibold uppercase text-theme-text-secondary">
              {fallbackLabel}
            </div>
          )}
          {/* Indicador de unreads - dentro del contenedor rounded para recortar overflow */}
          <div
            className={cn(
              "absolute bottom-0 left-1/2 h-1.5 w-3/4 -translate-x-1/2 border-t border-x border-black/30 rounded-t-sm bg-theme-unread-bg",
              "group-data-[active=true]/item:border-theme-border-accent-active-channel",
              "hidden group-data-[unreads=true]/item:block group-data-[mentions=true]/item:hidden",
            )}
          />
        </div>

        {/* Indicador de mención - siempre renderizado, oculto via CSS */}
        <div
          className={cn(
            "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-black/30 bg-theme-notification-bg",
            "group-data-[active=true]/item:border-theme-border-accent-active-channel",
            // Mostrar solo si: tiene menciones
            "hidden group-data-[mentions=true]/item:flex",
          )}
        >
          <AtSign
            className="h-2.5 w-2.5 text-theme-text-tertiary"
            strokeWidth={3}
          />
        </div>
      </div>
    ),
    [displayImageUrl, fallbackLabel, isGatherendCdnUrl, name], // Solo dependencias que REALMENTE cambian el contenido
  );

  // Resuelve la ultima vista recordada sin romper si el canal guardado ya no existe.
  const resolveBoardViewFromMemory = useCallback(
    (board: BoardWithData): BoardViewTarget => {
      const view = resolveLastBoardViewForBoard(board.id);
      if (
        view.kind === "channels:channel" &&
        !board.channels.some((channel) => channel.id === view.channelId)
      ) {
        return { kind: "channels:list" };
      }

      return view;
    },
    [],
  );

  const pushOptimisticBoardUrl = useCallback(
    (boardId: string, view: BoardViewTarget) => {
      const targetUrl =
        view.kind === "forum"
          ? `/boards/${boardId}/forum`
          : view.kind === "rules"
            ? `/boards/${boardId}/rules`
            : view.kind === "wiki"
              ? `/boards/${boardId}/wiki`
              : view.kind === "ranking"
                ? `/boards/${boardId}/ranking`
                : view.kind === "channels:list"
                  ? `/boards/${boardId}/channels`
                  : `/boards/${boardId}/rooms/${view.channelId}`;
      const targetState =
        view.kind === "forum"
          ? { boardId, isForum: true }
          : view.kind === "rules"
            ? { boardId, isRules: true }
            : view.kind === "wiki"
              ? { boardId, isWiki: true }
              : view.kind === "ranking"
                ? { boardId, isRanking: true }
                : view.kind === "channels:list"
                  ? { boardId, isChannels: true }
                  : { boardId, channelId: view.channelId };
      window.history.pushState(targetState, "", targetUrl);
    },
    [],
  );

  const navigateBoardView = useCallback(
    (
      boardId: string,
      view: BoardViewTarget,
      options?: { history?: "push" | "replace" },
    ) => {
      if (switchBoardView) {
        switchBoardView(boardId, view, options);
        return;
      }

      if (view.kind === "channels:channel") {
        switchBoard?.(boardId, view.channelId, options);
      } else {
        switchBoard?.(boardId, undefined, options);
      }
    },
    [switchBoard, switchBoardView],
  );

  const onClick = useCallback(async () => {
    if (!isNavigationReady || !switchBoard) {
      router.push(`/boards/${id}/rules`);
      return;
    }

    const optimisticView = resolveLastBoardViewForBoard(id);

    const cachedBoard = queryClient.getQueryData<BoardWithData>(["board", id]);
    if (cachedBoard) {
      navigateBoardView(id, resolveBoardViewFromMemory(cachedBoard));
      return;
    }

    // Sin cache: URL optimista inmediata, pero mantenemos la UI actual hasta tener datos.
    pushOptimisticBoardUrl(id, optimisticView);
    setIsNavigating(true);
    try {
      const response = await fetchWithRetry(`/api/boards/${id}`, {
        credentials: "include",
        retryOn401: true,
        maxRetries: 3,
        initialDelay: 200,
      });
      if (response.ok) {
        const board: BoardWithData = await response.json();
        // Guardar en cache para que los componentes tengan datos al instante
        queryClient.setQueryData(["board", id], board);
        navigateBoardView(id, resolveBoardViewFromMemory(board), {
          history: "replace",
        });
      } else {
        navigateBoardView(id, optimisticView, { history: "replace" });
      }
    } catch {
      navigateBoardView(id, optimisticView, { history: "replace" });
    } finally {
      setIsNavigating(false);
    }
  }, [
    switchBoard,
    isNavigationReady,
    router,
    id,
    queryClient,
    navigateBoardView,
    pushOptimisticBoardUrl,
    resolveBoardViewFromMemory,
  ]);

  return (
    <button
      onClick={onClick}
      disabled={isNavigating}
      className="group relative flex items-center"
    >
      <div className="flex ">
        <ActionTooltip side="right" align="center" label={name}>
          {/* Wrapper con data-attributes para estilos CSS condicionales */}
          {/* visualContent usa group-data-* selectors para leer estos valores */}
          <div
            className="group/item"
            data-active={isActive}
            data-navigating={isNavigating}
            data-mentions={hasMentions}
            data-unreads={hasUnreads}
          >
            {visualContent}
          </div>
        </ActionTooltip>
      </div>
    </button>
  );
};

// Memoización con comparador personalizado para evitar re-renders innecesarios
// isActive es boolean — solo 2 items cambian de valor al navegar (el anterior activo y el nuevo)
export const NavigationItem = memo(NavigationItemComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.boardImageUrl === next.boardImageUrl &&
    prev.name === next.name &&
    prev.isActive === next.isActive &&
    arraysEqual(prev.channelIds, next.channelIds)
  );
});
