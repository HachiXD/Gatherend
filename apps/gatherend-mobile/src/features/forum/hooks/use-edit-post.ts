import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { editPost } from "../application/edit-post";
import { boardPostsQueryKey } from "../queries";
import type { ForumPostsPage } from "../domain/post";

export function useEditPost(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      editPost(postId, content),
    onSuccess: (updated) => {
      queryClient.setQueryData<InfiniteData<ForumPostsPage>>(
        boardPostsQueryKey(boardId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((post) =>
                post.id === updated.id
                  ? { ...post, content: updated.content, updatedAt: updated.updatedAt }
                  : post,
              ),
            })),
          };
        },
      );
    },
  });
}
