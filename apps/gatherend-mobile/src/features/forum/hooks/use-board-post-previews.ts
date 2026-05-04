import { useInfiniteQuery } from "@tanstack/react-query";
import { getBoardPostPreviews } from "../application/get-board-post-previews";
import {
  boardPostPreviewsQueryKey,
  FORUM_POSTS_GC_TIME_MS,
  FORUM_POSTS_STALE_TIME_MS,
} from "../queries";

export function useBoardPostPreviews(boardId: string | undefined) {
  return useInfiniteQuery({
    queryKey: boardPostPreviewsQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardPostPreviews(boardId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: FORUM_POSTS_STALE_TIME_MS,
    gcTime: FORUM_POSTS_GC_TIME_MS,
    enabled: !!boardId,
  });
}
