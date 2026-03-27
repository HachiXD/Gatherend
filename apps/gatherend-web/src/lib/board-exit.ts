import type { QueryClient } from "@tanstack/react-query";
import { removeUserBoardFromCache, type UserBoard } from "@/hooks/use-user-boards";
import { useModal } from "@/hooks/use-modal-store";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";

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
  // Read channel IDs before destroying the cache so we can clean notification state
  const userBoards = queryClient.getQueryData<UserBoard[]>(["user-boards"]);
  const channelIds = userBoards?.find((b) => b.id === boardId)?.channels.map((c) => c.id) ?? [];

  if (channelIds.length > 0) {
    useUnreadStore.getState().clearBoardUnreads(channelIds);
    useMentionStore.getState().clearBoardMentions(channelIds);
  }

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
