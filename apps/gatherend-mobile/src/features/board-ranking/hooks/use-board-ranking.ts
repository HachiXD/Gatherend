import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { getBoardRanking } from "../api/board-ranking-api";
import type { BoardRankingPage } from "../types";

export const boardRankingQueryKey = (boardId: string) =>
  ["board-ranking", boardId] as const;

export function useBoardRanking(boardId: string | undefined) {
  return useInfiniteQuery<
    BoardRankingPage,
    Error,
    InfiniteData<BoardRankingPage>,
    ReturnType<typeof boardRankingQueryKey>,
    string | null
  >({
    queryKey: boardRankingQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardRanking(boardId!, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(boardId),
    staleTime: 1000 * 60,
  });
}
