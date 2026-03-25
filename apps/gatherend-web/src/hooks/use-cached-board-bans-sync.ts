"use client";

import { useSocketClient, useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface BoardMemberUnbannedPayload {
  boardId: string;
  profileId: string;
  timestamp: number;
}

interface BoardMemberBannedPayload {
  boardId: string;
  profileId: string;
  timestamp: number;
}

function hasCachedBoardBans(
  queryClient: ReturnType<typeof useQueryClient>,
  boardId: string,
): boolean {
  return queryClient
    .getQueryCache()
    .getAll()
    .some((query) => {
      const { queryKey } = query;
      return (
        Array.isArray(queryKey) &&
        queryKey.length === 2 &&
        queryKey[0] === "boardBans" &&
        queryKey[1] === boardId
      );
    });
}

export function useCachedBoardBansSync(): void {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const refetchBoardBansIfCached = (boardId: string) => {
      if (!hasCachedBoardBans(queryClient, boardId)) return;

      void queryClient.refetchQueries({
        queryKey: ["boardBans", boardId],
        exact: true,
        type: "all",
      });
    };

    const handleMemberUnbanned = (payload: BoardMemberUnbannedPayload) => {
      refetchBoardBansIfCached(payload.boardId);
    };

    const handleMemberBanned = (payload: BoardMemberBannedPayload) => {
      if (!hasCachedBoardBans(queryClient, payload.boardId)) return;
      refetchBoardBansIfCached(payload.boardId);
    };

    socket.on("board:member-banned", handleMemberBanned);
    socket.on("board:member-unbanned", handleMemberUnbanned);

    return () => {
      socket.off("board:member-banned", handleMemberBanned);
      socket.off("board:member-unbanned", handleMemberUnbanned);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (reconnectVersion === 0) return;

    queryClient
      .getQueryCache()
      .getAll()
      .forEach((query) => {
        const { queryKey } = query;
        if (
          Array.isArray(queryKey) &&
          queryKey.length === 2 &&
          queryKey[0] === "boardBans" &&
          typeof queryKey[1] === "string"
        ) {
          void queryClient.refetchQueries({
            queryKey: ["boardBans", queryKey[1]],
            exact: true,
            type: "all",
          });
        }
      });
  }, [queryClient, reconnectVersion]);
}
