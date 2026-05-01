import { useInfiniteQuery } from "@tanstack/react-query";
import { getBoardPosts } from "../application/get-board-posts";
import {
  boardPostsQueryKey,
  FORUM_POSTS_GC_TIME_MS,
  FORUM_POSTS_STALE_TIME_MS,
} from "../queries";

export function useBoardPosts(boardId: string | undefined) {
  return useInfiniteQuery({
    queryKey: boardPostsQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardPosts(boardId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: FORUM_POSTS_STALE_TIME_MS,
    gcTime: FORUM_POSTS_GC_TIME_MS,
    enabled: !!boardId,
  });
}
