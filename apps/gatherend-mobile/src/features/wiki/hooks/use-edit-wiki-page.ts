import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { editWikiPage } from "../application/edit-wiki-page";
import { wikiPagesQueryKey, wikiPageQueryKey } from "../queries";
import type { EditWikiPageInput, WikiPagePreviewsPage } from "../domain/wiki";

export function useEditWikiPage(
  boardId: string,
  pageId: string,
  channelId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EditWikiPageInput) =>
      editWikiPage(boardId, pageId, channelId, input),
    onSuccess: (updatedPage) => {
      // Update the detail cache
      queryClient.setQueryData(
        wikiPageQueryKey(boardId, pageId, channelId),
        updatedPage,
      );

      // Update title in the list cache if it changed
      if (updatedPage.title) {
        queryClient.setQueryData<InfiniteData<WikiPagePreviewsPage>>(
          wikiPagesQueryKey(boardId, channelId),
          (current) => {
            if (!current) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === pageId
                    ? {
                        ...item,
                        title: updatedPage.title,
                        updatedAt: updatedPage.updatedAt,
                      }
                    : item,
                ),
              })),
            };
          },
        );
      }
    },
  });
}
