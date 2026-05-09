import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { deleteWikiPage } from "../application/delete-wiki-page";
import { wikiPagesQueryKey, wikiPageQueryKey } from "../queries";
import type { WikiPagePreviewsPage } from "../domain/wiki";

export function useDeleteWikiPage(boardId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => deleteWikiPage(boardId, pageId, channelId),
    onSuccess: (_data, pageId) => {
      queryClient.removeQueries({
        queryKey: wikiPageQueryKey(boardId, pageId, channelId),
      });
      queryClient.setQueryData<InfiniteData<WikiPagePreviewsPage>>(
        wikiPagesQueryKey(boardId, channelId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== pageId),
            })),
          };
        },
      );
    },
  });
}
