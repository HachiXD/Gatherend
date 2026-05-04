import { useInfiniteQuery } from "@tanstack/react-query";
import { getWikiPages } from "../application/get-wiki-pages";
import {
  wikiPagesQueryKey,
  WIKI_PAGES_GC_TIME_MS,
  WIKI_PAGES_STALE_TIME_MS,
} from "../queries";

export function useWikiPages(boardId: string | undefined) {
  return useInfiniteQuery({
    queryKey: wikiPagesQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getWikiPages(boardId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: WIKI_PAGES_STALE_TIME_MS,
    gcTime: WIKI_PAGES_GC_TIME_MS,
    enabled: !!boardId,
  });
}
