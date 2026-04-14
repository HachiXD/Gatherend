"use client";

import { memo, useMemo } from "react";
import { useUserBoards } from "@/hooks/use-user-boards";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { NavigationAction } from "@/components/navigation/navigation-action";
import { NavigationItem } from "@/components/navigation/navigation-item";
import { BoardDiscovery } from "@/components/board/header/board-discovery";
import { getBoardImageUrl } from "@/lib/avatar-utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface BoardItem {
  id: string;
  name: string;
  boardImageUrl: string | null;
  imageAsset: ClientUploadedAsset | null;
  channelIds: string[];
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
      boardImageUrl: getBoardImageUrl(
        board.imageAsset?.url,
        board.id,
        board.name,
        96,
      ),
      imageAsset: board.imageAsset,
      channelIds: board.channels?.map((c) => c.id) || [],
    }));
  }, [boards]);

  if (isLoading) {
    return <NavigationSidebarSkeleton />;
  }

  return (
    <div className="w-full h-full overflow-y-auto py-3 scrollbar-hidden">
      <div className="flex flex-col items-center  gap-3 ">
        <NavigationAction />
        <BoardDiscovery />
        {boardItems.map((board) => (
          <NavigationItem
            key={board.id}
            id={board.id}
            name={board.name}
            boardImageUrl={board.boardImageUrl}
            imageAsset={board.imageAsset}
            channelIds={board.channelIds}
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
    <div className="w-full h-full overflow-y-auto py-3 scrollbar-hidden">
      <div className="flex flex-col items-center gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-full" />
        ))}
      </div>
    </div>
  );
}
