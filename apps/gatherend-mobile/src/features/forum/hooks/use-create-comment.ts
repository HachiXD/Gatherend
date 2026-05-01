import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createComment } from "../application/create-comment";
import { boardPostsQueryKey, postCommentsQueryKey } from "../queries";
import type {
  ForumPostCommentsResult,
  ForumPostsPage,
} from "../domain/post";

export function useCreateComment(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createComment,
    onSuccess: (newComment, { postId }) => {
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
                  commentCount: post.commentCount + 1,
                  latestComments: [
                    ...post.latestComments,
                    newComment,
                  ].slice(-5),
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
                totalCount: current.totalCount + 1,
                items: [...current.items, newComment],
              }
            : current,
      );
    },
  });
}
