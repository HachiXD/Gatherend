"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
import type { BoardWithData } from "@/components/providers/board-provider";

export interface UserBoard {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  channels: { id: string }[];
}

interface PartialUserBoardInput {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  targetChannelId?: string | null;
}

function upsertUserBoard(
  oldBoards: UserBoard[] | undefined,
  nextBoard: UserBoard,
): UserBoard[] {
  if (!oldBoards) {
    return [nextBoard];
  }

  const existingIndex = oldBoards.findIndex((board) => board.id === nextBoard.id);
  if (existingIndex === -1) {
    return [...oldBoards, nextBoard];
  }

  return oldBoards.map((board) =>
    board.id === nextBoard.id
      ? {
          ...board,
          ...nextBoard,
        }
      : board,
  );
}

export function upsertUserBoardFromJoin(
  queryClient: QueryClient,
  input: PartialUserBoardInput,
): void {
  const nextBoard: UserBoard = {
    id: input.id,
    name: input.name,
    imageAsset: input.imageAsset,
    channels: input.targetChannelId ? [{ id: input.targetChannelId }] : [],
  };

  queryClient.setQueryData<UserBoard[]>(["user-boards"], (old) =>
    upsertUserBoard(old, nextBoard),
  );
}

export function syncUserBoardFromBoardData(
  queryClient: QueryClient,
  board: BoardWithData,
): void {
  const allChannels = board.channels;

  const nextBoard: UserBoard = {
    id: board.id,
    name: board.name,
    imageAsset: board.imageAsset,
    channels: allChannels.map((channel) => ({ id: channel.id })),
  };

  queryClient.setQueryData<UserBoard[]>(["user-boards"], (old) =>
    upsertUserBoard(old, nextBoard),
  );
}

export function removeUserBoardFromCache(
  queryClient: QueryClient,
  boardId: string,
): UserBoard[] {
  const currentBoards = queryClient.getQueryData<UserBoard[]>(["user-boards"]) ?? [];
  const nextBoards = currentBoards.filter((board) => board.id !== boardId);
  queryClient.setQueryData<UserBoard[]>(["user-boards"], nextBoards);
  return nextBoards;
}

export function useUserBoards() {
  return useQuery<UserBoard[]>({
    queryKey: ["user-boards"],
    queryFn: async () => {
      const response = await fetch("/api/boards", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch boards");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
