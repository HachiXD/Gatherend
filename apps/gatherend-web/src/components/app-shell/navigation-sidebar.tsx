"use client";

import { memo, useMemo } from "react";
import { useUserBoards } from "@/hooks/use-user-boards";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { NavigationAction } from "@/components/navigation/navigation-action";
import { NavigationItem } from "@/components/navigation/navigation-item";
import { getBoardImageUrl } from "@/lib/avatar-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BoardItem {
  id: string;
  name: string;
  imageUrl: string | null;
  channelIds: string[];
  mainChannelId: string | null;
}

/**
 * Sidebar de navegación con los boards del usuario.
 * Todos los boards están en el DOM para scroll nativo y suave.
 *
 * OPTIMIZACIÓN: Se suscribe a useBoardSwitchRouting() para obtener
 * currentBoardId y pasarlo como prop a NavigationItem, evitando que
 * cada item se suscriba individualmente al contexto completo.
 */
function NavigationSidebarClientInner() {
  const { data: boards, isLoading } = useUserBoards();
  // Solo depende del board activo (no del channel/conversation/discovery),
  // así evitamos re-renders en navegación dentro del mismo board.
  const currentBoardId = useCurrentBoardId();

  // Memoizar la transformación de boards
  const boardItems = useMemo((): BoardItem[] => {
    if (!boards) return [];
    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      imageUrl: getBoardImageUrl(board.imageUrl, board.id, board.name, 96),
      channelIds: board.channels?.map((c) => c.id) || [],
      mainChannelId: board.mainChannelId ?? null,
    }));
  }, [boards]);

  if (isLoading) {
    return <NavigationSidebarSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-y-auto pt-3 pb-3 scrollbar-hidden">
      <div className="grid grid-cols-5 gap-x-0 gap-y-3 place-items-center -translate-x-2">
        <div className="translate-x-1.5">
          <NavigationAction />
        </div>
        {boardItems.map((board) => (
          <NavigationItem
            key={board.id}
            id={board.id}
            name={board.name}
            imageUrl={board.imageUrl}
            channelIds={board.channelIds}
            mainChannelId={board.mainChannelId}
            isActive={currentBoardId === board.id}
          />
        ))}
      </div>
    </div>
  );
}

// Memoizar el componente completo
export const NavigationSidebarClient = memo(NavigationSidebarClientInner);

function NavigationSidebarSkeleton() {
  return (
    <div className="w-full h-full overflow-y-auto pt-3 pb-3 scrollbar-hidden">
      <div className="grid grid-cols-4 gap-3 place-items-center -translate-x-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-full" />
        ))}
      </div>
    </div>
  );
}
