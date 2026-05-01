import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { deletePost } from "../application/delete-post";
import { boardPostsQueryKey } from "../queries";
import type { ForumPostsPage } from "../domain/post";

export function useDeletePost(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.setQueryData<InfiniteData<ForumPostsPage>>(
        boardPostsQueryKey(boardId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.filter((post) => post.id !== postId),
            })),
          };
        },
      );
    },
  });
}
