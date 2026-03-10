"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";
import { useNavigationStore } from "@/hooks/use-navigation-store";
import { getLastChannelForBoard } from "@/contexts/board-switch-context";
import { AtSign } from "lucide-react";
import type { BoardWithData } from "@/components/providers/board-provider";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";

const R2_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN || "";

interface NavigationItemProps {
  id: string;
  imageUrl: string | null;
  name: string;
  channelIds: string[];
  mainChannelId?: string | null;
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
  imageUrl,
  name,
  channelIds,
  mainChannelId = null,
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
  const isNavigationReady = switchBoard !== null;

  const queryClient = useQueryClient();
  const [isNavigating, setIsNavigating] = useState(false);

  // Detectar si es Dicebear para usar quality máxima
  const [forceOriginalImage, setForceOriginalImage] = useState(false);

  const displayImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    if (forceOriginalImage) return imageUrl;
    return getOptimizedStaticUiImageUrl(imageUrl, {
      w: 96,
      h: 96,
      q: 82,
      resize: "fill",
      gravity: "sm",
    });
  }, [forceOriginalImage, imageUrl]);

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
            "relative h-[48px] w-[48px] rounded-full transition-all overflow-hidden cursor-pointer",
            // Estilos base + hover (cuando NO activo)
            "hover:ring-2 hover:ring-[#33bba9]",
            // Estilos activo via data-attribute (el wrapper padre tiene group/item y data-active)
            "group-data-[active=true]/item:ring-2 group-data-[active=true]/item:ring-[#33bba9]",
            "group-data-[active=true]/item:rounded-full",
            // Override hover cuando está activo (no queremos doble ring)
            "group-data-[active=true]/item:hover:ring-2",
            // Estilos navegando via data-attribute
            "group-data-[navigating=true]/item:opacity-70 group-data-[navigating=true]/item:animate-pulse",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {displayImageUrl && (
            <img
              src={displayImageUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
              crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
              onError={() => setForceOriginalImage(true)}
            />
          )}
        </div>

        {/* Indicador de mención - siempre renderizado, oculto via CSS */}
        <div
          className={cn(
            "absolute -top-1 -right-1 w-5 h-5 bg-[#E57373] rounded-full border-2 border-[#334b49] flex items-center justify-center",
            // Mostrar solo si: tiene menciones Y NO está activo
            "hidden group-data-[mentions=true]/item:block group-data-[active=true]/item:hidden",
          )}
        >
          <AtSign className="w-3 h-3 text-white" strokeWidth={3} />
        </div>

        {/* Indicador de unreads - siempre renderizado, oculto via CSS */}
        <div
          className={cn(
            "absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#D6A86C] rounded-full border-2 border-[#334b49]",
            // Mostrar solo si: tiene unreads Y NO tiene menciones Y NO está activo
            "hidden group-data-[unreads=true]/item:block group-data-[mentions=true]/item:hidden group-data-[active=true]/item:hidden",
          )}
        />
      </div>
    ),
    [displayImageUrl, isGatherendCdnUrl, name], // Solo dependencias que REALMENTE cambian el contenido
  );

  // Helper para obtener el primer canal de un board
  const getFirstChannelFromBoard = useCallback(
    (board: BoardWithData): string | null => {
      const allChannels = [
        ...board.channels,
        ...board.categories.flatMap((cat) => cat.channels),
      ];
      if (allChannels.length === 0) return null;
      // Prioridad: canal "gathern" (MAIN) > primer canal por posición
      const gathernChannel = allChannels.find((c) => c.name === "gathern");
      if (gathernChannel) return gathernChannel.id;
      const sortedChannels = [...allChannels].sort(
        (a, b) => a.position - b.position,
      );
      return sortedChannels[0]?.id || null;
    },
    [],
  );

  const pushOptimisticBoardUrl = useCallback(
    (boardId: string, channelId?: string | null) => {
      const targetUrl = channelId
        ? `/boards/${boardId}/rooms/${channelId}`
        : `/boards/${boardId}`;
      const targetState = channelId ? { boardId, channelId } : { boardId };
      window.history.pushState(targetState, "", targetUrl);
    },
    [],
  );

  const onClick = useCallback(async () => {
    if (!isNavigationReady || !switchBoard) {
      router.push(`/boards/${id}`);
      return;
    }

    // 1. Intentar obtener último canal del localStorage
    const lastChannelId = getLastChannelForBoard(id);
    if (lastChannelId) {
      // Verificar que el board esté en cache de React Query
      const cachedBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        id,
      ]);
      if (cachedBoard) {
        // Cache completo disponible - navegar directo
        switchBoard(id, lastChannelId);
        return;
      }
    }

    // 2. Verificar si hay board en cache de React Query (sin localStorage)
    const cachedBoard = queryClient.getQueryData<BoardWithData>(["board", id]);
    if (cachedBoard) {
      const channelId = lastChannelId || getFirstChannelFromBoard(cachedBoard);
      if (channelId) {
        switchBoard(id, channelId);
        return;
      }
    }

    // 3. No hay cache - URL optimista inmediata, pero mantener UI actual hasta tener datos.
    pushOptimisticBoardUrl(id, lastChannelId ?? mainChannelId);
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
        const channelId = getFirstChannelFromBoard(board);
        if (channelId) {
          switchBoard(id, channelId, { history: "replace" });
        } else {
          switchBoard(id, undefined, { history: "replace" });
        }
      } else {
        switchBoard(id, undefined, { history: "replace" });
      }
    } catch {
      switchBoard(id, undefined, { history: "replace" });
    } finally {
      setIsNavigating(false);
    }
  }, [
    switchBoard,
    isNavigationReady,
    router,
    id,
    mainChannelId,
    queryClient,
    getFirstChannelFromBoard,
    pushOptimisticBoardUrl,
  ]);

  return (
    <button
      onClick={onClick}
      disabled={isNavigating}
      className="group relative flex items-center"
    >
      <div className="flex pl-3">
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
    prev.imageUrl === next.imageUrl &&
    prev.name === next.name &&
    prev.isActive === next.isActive &&
    arraysEqual(prev.channelIds, next.channelIds)
  );
});
