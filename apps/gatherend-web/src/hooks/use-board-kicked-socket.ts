"use client";

import { useSocketClient, useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { type UserBoard } from "@/hooks/use-user-boards";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { exitBoardWithSpaFallback } from "@/lib/board-exit";

interface BoardKickedPayload {
  boardId: string;
  kickedProfileId: string;
  timestamp: number;
}

interface BoardBannedPayload {
  boardId: string;
  bannedProfileId: string;
  timestamp: number;
}

interface BoardDeletedPayload {
  boardId: string;
  deletedByProfileId: string;
  timestamp: number;
}

export function useBoardKickedSocket(): void {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();
  const router = useRouter();
  const boardSwitch = useBoardSwitchSafe();
  const currentBoardId = useCurrentBoardId();

  useEffect(() => {
    if (!socket) return;

    const handleBoardKicked = (payload: BoardKickedPayload) => {
      exitBoardWithSpaFallback({
        queryClient,
        router,
        boardSwitch,
        boardId: payload.boardId,
        currentBoardId,
      });
    };

    const handleBoardBanned = (payload: BoardBannedPayload) => {
      exitBoardWithSpaFallback({
        queryClient,
        router,
        boardSwitch,
        boardId: payload.boardId,
        currentBoardId,
      });
    };

    const handleBoardDeleted = (payload: BoardDeletedPayload) => {
      exitBoardWithSpaFallback({
        queryClient,
        router,
        boardSwitch,
        boardId: payload.boardId,
        currentBoardId,
      });
    };

    socket.on("board:kicked", handleBoardKicked);
    socket.on("board:banned", handleBoardBanned);
    socket.on("board:deleted", handleBoardDeleted);

    return () => {
      socket.off("board:kicked", handleBoardKicked);
      socket.off("board:banned", handleBoardBanned);
      socket.off("board:deleted", handleBoardDeleted);
    };
  }, [socket, queryClient, currentBoardId, boardSwitch, router]);

  useEffect(() => {
    if (reconnectVersion === 0) return;
    if (!queryClient.getQueryState(["user-boards"])) return;

    const reconcileCurrentBoardMembership = async () => {
      await queryClient.refetchQueries({
        queryKey: ["user-boards"],
        exact: true,
        type: "all",
      });

      const boards = queryClient.getQueryData<UserBoard[]>(["user-boards"]) ?? [];
      const stillHasCurrentBoard = boards.some((board) => board.id === currentBoardId);

      if (stillHasCurrentBoard) {
        return;
      }

      exitBoardWithSpaFallback({
        queryClient,
        router,
        boardSwitch,
        boardId: currentBoardId,
        currentBoardId,
      });
    };

    void reconcileCurrentBoardMembership();
  }, [boardSwitch, currentBoardId, queryClient, reconnectVersion, router]);
}
