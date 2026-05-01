import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { deleteComment } from "../application/delete-comment";
import { boardPostsQueryKey, postCommentsQueryKey } from "../queries";
import type { ForumPostCommentsResult, ForumPostsPage } from "../domain/post";

type DeleteCommentInput = { postId: string; commentId: string };

export function useDeleteComment(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, commentId }: DeleteCommentInput) =>
      deleteComment(postId, commentId),
    onSuccess: (_data, { postId, commentId }) => {
      const markDeleted = <T extends { id: string; content: string; imageAsset: unknown; deleted: boolean }>(
        comment: T,
      ): T => ({ ...comment, deleted: true, content: "", imageAsset: null });

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
                  commentCount: Math.max(0, post.commentCount - 1),
                  latestComments: post.latestComments.map((c) =>
                    c.id === commentId ? markDeleted(c) : c,
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
                totalCount: Math.max(0, current.totalCount - 1),
                items: current.items.map((c) =>
                  c.id === commentId ? markDeleted(c) : c,
                ),
              }
            : current,
      );
    },
  });
}
