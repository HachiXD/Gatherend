"use client";

import { useSocketClient, useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { acquireBoardRoom, releaseBoardRoom, rejoinBoardRooms } from "@/hooks/board-room-subscriptions";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientProfileSummary } from "@/types/uploaded-assets";
import { useEffect, useRef } from "react";

interface MemberJoinedPayload {
  boardId: string;
  profile: Pick<ClientProfileSummary, "id" | "username" | "avatarAsset">;
  timestamp: number;
}

interface MemberLeftPayload {
  boardId: string;
  profileId: string;
  timestamp: number;
}

interface MemberRoleChangedPayload {
  boardId: string;
  profileId: string;
  role: string;
  timestamp: number;
}

function getCachedBoardIds(queryClient: ReturnType<typeof useQueryClient>): Set<string> {
  const cachedBoardIds = new Set<string>();

  queryClient
    .getQueryCache()
    .getAll()
    .forEach((query) => {
      const { queryKey } = query;
      if (
        Array.isArray(queryKey) &&
        queryKey.length === 2 &&
        queryKey[0] === "board" &&
        typeof queryKey[1] === "string"
      ) {
        cachedBoardIds.add(queryKey[1]);
      }
    });

  return cachedBoardIds;
}

export function useCachedBoardSync(): void {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();
  const observedBoardIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    const syncObservedRooms = () => {
      const cachedBoardIds = getCachedBoardIds(queryClient);
      const observedBoardIds = observedBoardIdsRef.current;

      observedBoardIds.forEach((boardId) => {
        if (!cachedBoardIds.has(boardId)) {
          releaseBoardRoom(socket, boardId);
          observedBoardIds.delete(boardId);
        }
      });

      cachedBoardIds.forEach((boardId) => {
        if (!observedBoardIds.has(boardId)) {
          acquireBoardRoom(socket, boardId);
          observedBoardIds.add(boardId);
        }
      });
    };

    const refetchBoardIfCached = (boardId: string) => {
      if (!getCachedBoardIds(queryClient).has(boardId)) return;

      void queryClient.refetchQueries({
        queryKey: ["board", boardId],
        exact: true,
        type: "all",
      });
    };

    const handleMemberJoined = (payload: MemberJoinedPayload) => {
      refetchBoardIfCached(payload.boardId);
    };

    const handleMemberLeft = (payload: MemberLeftPayload) => {
      refetchBoardIfCached(payload.boardId);
    };

    const handleMemberRoleChanged = (payload: MemberRoleChangedPayload) => {
      refetchBoardIfCached(payload.boardId);
    };

    const handleConnect = () => {
      rejoinBoardRooms(socket);
      syncObservedRooms();
    };

    const unsubscribeQueryCache = queryClient
      .getQueryCache()
      .subscribe(() => {
        syncObservedRooms();
      });

    syncObservedRooms();

    socket.on("connect", handleConnect);
    socket.on("board:member-joined", handleMemberJoined);
    socket.on("board:member-left", handleMemberLeft);
    socket.on("board:member-role-changed", handleMemberRoleChanged);

    return () => {
      unsubscribeQueryCache();
      socket.off("connect", handleConnect);
      socket.off("board:member-joined", handleMemberJoined);
      socket.off("board:member-left", handleMemberLeft);
      socket.off("board:member-role-changed", handleMemberRoleChanged);

      observedBoardIdsRef.current.forEach((boardId) => {
        releaseBoardRoom(socket, boardId);
      });
      observedBoardIdsRef.current.clear();
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (reconnectVersion === 0) return;

    getCachedBoardIds(queryClient).forEach((boardId) => {
      void queryClient.refetchQueries({
        queryKey: ["board", boardId],
        exact: true,
        type: "all",
      });
    });
  }, [queryClient, reconnectVersion]);
}
