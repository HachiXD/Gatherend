import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { editComment } from "../application/edit-comment";
import { boardPostsQueryKey, postCommentsQueryKey } from "../queries";
import type { ForumPostCommentsResult, ForumPostsPage } from "../domain/post";

export function useEditComment(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      commentId,
      content,
    }: {
      postId: string;
      commentId: string;
      content: string;
    }) => editComment(postId, commentId, content),
    onSuccess: (updated, { postId }) => {
      queryClient.setQueryData<InfiniteData<ForumPostsPage>>(
        boardPostsQueryKey(boardId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => {
                if (post.id !== postId) return post;
                return {
                  ...post,
                  latestComments: post.latestComments.map((c) =>
                    c.id === updated.id ? updated : c,
                  ),
                };
              }),
            })),
          };
        },
      );

      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((c) =>
                  c.id === updated.id ? updated : c,
                ),
              }
            : current,
      );
    },
  });
}
