import type { QueryClient } from "@tanstack/react-query";
import { removeUserBoardFromCache } from "@/hooks/use-user-boards";
import { useModal } from "@/hooks/use-modal-store";
import { useOverlayStore } from "@/hooks/use-overlay-store";

interface BoardSwitchLike {
  isClientNavigationEnabled: boolean;
  switchBoard: (boardId: string, channelId?: string) => void;
}

interface RouterLike {
  push: (href: string) => void;
}

interface ExitBoardOptions {
  queryClient: QueryClient;
  router: RouterLike;
  boardSwitch?: BoardSwitchLike | null;
  boardId: string;
  currentBoardId?: string | null;
}

export function exitBoardWithSpaFallback({
  queryClient,
  router,
  boardSwitch,
  boardId,
  currentBoardId,
}: ExitBoardOptions): void {
  const remainingBoards = removeUserBoardFromCache(queryClient, boardId);
  queryClient.removeQueries({ queryKey: ["board", boardId] });

  if (boardId !== currentBoardId) {
    return;
  }

  useModal.getState().onClose();
  useOverlayStore.getState().onClose();

  const nextBoard = remainingBoards[0];
  if (nextBoard) {
    if (boardSwitch?.isClientNavigationEnabled) {
      boardSwitch.switchBoard(
        nextBoard.id,
        nextBoard.mainChannelId ?? undefined,
      );
    } else {
      router.push(
        nextBoard.mainChannelId
          ? `/boards/${nextBoard.id}/rooms/${nextBoard.mainChannelId}`
          : `/boards/${nextBoard.id}`,
      );
    }
    return;
  }

  router.push("/boards");
}
