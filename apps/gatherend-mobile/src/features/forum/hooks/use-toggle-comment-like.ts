import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nextApiFetch } from "@/src/services/next-api/next-api-fetch";
import { postCommentsQueryKey } from "../queries";
import type { ForumPostCommentsResult, ForumPostComment } from "../domain/post";

async function toggleCommentLike(
  postId: string,
  commentId: string,
  isLiked: boolean,
): Promise<void> {
  const method = isLiked ? "DELETE" : "POST";
  await nextApiFetch(`/api/posts/${postId}/comments/${commentId}/likes`, {
    method,
  });
}

export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      isLiked,
    }: {
      commentId: string;
      isLiked: boolean;
    }) => toggleCommentLike(postId, commentId, isLiked),

    onMutate: async ({ commentId, isLiked }) => {
      await queryClient.cancelQueries({
        queryKey: postCommentsQueryKey(postId),
      });

      const prev = queryClient.getQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
      );

      const delta = isLiked ? -1 : 1;

      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((c: ForumPostComment) =>
              c.id === commentId
                ? {
                    ...c,
                    isLikedByCurrentUser: !isLiked,
                    likeCount: Math.max(0, c.likeCount + delta),
                  }
                : c,
            ),
          };
        },
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(postCommentsQueryKey(postId), ctx.prev);
    },
  });
}
