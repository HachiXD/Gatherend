import { useQuery } from "@tanstack/react-query";
import { getWikiPage } from "../application/get-wiki-page";
import {
  wikiPageQueryKey,
  WIKI_PAGE_GC_TIME_MS,
  WIKI_PAGE_STALE_TIME_MS,
} from "../queries";

export function useWikiPage(
  boardId: string | undefined,
  pageId: string | undefined,
) {
  return useQuery({
    queryKey: wikiPageQueryKey(boardId ?? "", pageId ?? ""),
    queryFn: () => getWikiPage(boardId!, pageId!),
    staleTime: WIKI_PAGE_STALE_TIME_MS,
    gcTime: WIKI_PAGE_GC_TIME_MS,
    enabled: !!boardId && !!pageId,
  });
}
