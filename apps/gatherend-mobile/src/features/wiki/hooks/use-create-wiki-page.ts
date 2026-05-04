import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { createWikiPage } from "../application/create-wiki-page";
import { wikiPagesQueryKey } from "../queries";
import type { WikiPagePreviewsPage } from "../domain/wiki";

export function useCreateWikiPage(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWikiPage,
    onSuccess: (newPage) => {
      const preview = {
        id: newPage.id,
        title: newPage.title,
        createdAt: newPage.createdAt,
        updatedAt: newPage.updatedAt,
        author: newPage.author,
      };
      queryClient.setQueryData<InfiniteData<WikiPagePreviewsPage>>(
        wikiPagesQueryKey(boardId),
        (current) => {
          if (!current) return current;
          const [firstPage, ...rest] = current.pages;
          return {
            ...current,
            pages: [
              { ...firstPage, items: [preview, ...firstPage.items] },
              ...rest,
            ],
          };
        },
      );
    },
  });
}
