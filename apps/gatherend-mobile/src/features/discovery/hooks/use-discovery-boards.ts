import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { getDiscoveryBoards } from "@/src/features/discovery/api/get-discovery-boards";
import { DISCOVERY_BOARDS_QUERY_KEY } from "@/src/features/discovery/queries";
import type { DiscoveryBoardsPage } from "@/src/features/discovery/types";

export function useDiscoveryBoards() {
  return useInfiniteQuery<
    DiscoveryBoardsPage,
    Error,
    InfiniteData<DiscoveryBoardsPage>,
    typeof DISCOVERY_BOARDS_QUERY_KEY,
    string | null
  >({
    queryKey: DISCOVERY_BOARDS_QUERY_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getDiscoveryBoards({
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 65,
  });
}
