import { useQuery, useQueryClient } from "@tanstack/react-query";
import { syncUserBoardFromBoardData } from "../cache";
import { getBoard } from "../api/get-board";
import {
  BOARD_GC_TIME_MS,
  BOARD_STALE_TIME_MS,
  boardQueryKey,
} from "../queries";
import type { BoardWithData } from "../types/board";

export function useBoard(boardId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery<BoardWithData>({
    queryKey: boardId ? boardQueryKey(boardId) : ["board", "unknown"],
    queryFn: async () => {
      const board = await getBoard(boardId ?? "");
      syncUserBoardFromBoardData(queryClient, board);
      return board;
    },
    enabled: Boolean(boardId),
    staleTime: BOARD_STALE_TIME_MS,
    gcTime: BOARD_GC_TIME_MS,
  });
}
