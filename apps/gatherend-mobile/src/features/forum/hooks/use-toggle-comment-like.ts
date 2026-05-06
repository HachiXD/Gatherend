import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import {
  boardPostsQueryKey,
  postCommentsQueryKey,
  postQueryKey,
} from "../queries";
import type {
  ForumPost,
  ForumPostCommentsResult,
  ForumPostComment,
  ForumPostsPage,
} from "../domain/post";

type ToggleCommentLikeResponse = {
  likeCount: number;
  isLiked: boolean;
};

async function toggleCommentLike(
  postId: string,
  commentId: string,
  isLiked: boolean,
): Promise<ToggleCommentLikeResponse> {
  const method = isLiked ? "DELETE" : "POST";
  const response = await nextApiFetch(
    `/api/posts/${postId}/comments/${commentId}/likes`,
    {
      method,
    },
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(
        response,
        "No se pudo actualizar el like del comentario",
      ),
    );
  }

  return (await response.json()) as ToggleCommentLikeResponse;
}

function patchComment(
  comment: ForumPostComment,
  commentId: string,
  delta: number,
  isLiked: boolean,
): ForumPostComment {
  if (comment.id !== commentId) return comment;

  const baseLikeCount = Number.isFinite(comment.likeCount)
    ? comment.likeCount
    : Number(comment.likeCount ?? 0);

  return {
    ...comment,
    isLikedByCurrentUser: !isLiked,
    likeCount: Math.max(0, baseLikeCount + delta),
  };
}

function patchCommentWithServerState(
  comment: ForumPostComment,
  commentId: string,
  serverState: ToggleCommentLikeResponse,
): ForumPostComment {
  if (comment.id !== commentId) return comment;
  return {
    ...comment,
    isLikedByCurrentUser: serverState.isLiked,
    likeCount: Math.max(0, Number(serverState.likeCount ?? 0)),
  };
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
      await Promise.all([
        queryClient.cancelQueries({ queryKey: postCommentsQueryKey(postId) }),
        queryClient.cancelQueries({ queryKey: postQueryKey(postId) }),
      ]);

      const prevComments = queryClient.getQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
      );
      const prevPost = queryClient.getQueryData<ForumPost>(
        postQueryKey(postId),
      );

      const delta = isLiked ? -1 : 1;

      // Update expanded comments query
      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((c) =>
              patchComment(c, commentId, delta, isLiked),
            ),
          };
        },
      );

      // Update single post query (latestComments)
      queryClient.setQueryData<ForumPost>(postQueryKey(postId), (old) => {
        if (!old) return old;
        return {
          ...old,
          latestComments: old.latestComments.map((c) =>
            patchComment(c, commentId, delta, isLiked),
          ),
        };
      });

      // Update posts list query (latestComments embedded in each post)
      queryClient.setQueriesData<InfiniteData<ForumPostsPage>>(
        { queryKey: ["forum", "posts"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => {
                if (p.id !== postId) return p;
                return {
                  ...p,
                  latestComments: p.latestComments.map((c) =>
                    patchComment(c, commentId, delta, isLiked),
                  ),
                };
              }),
            })),
          };
        },
      );

      return { prevComments, prevPost };
    },

    onSuccess: (serverState, { commentId }) => {
      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((c) =>
              patchCommentWithServerState(c, commentId, serverState),
            ),
          };
        },
      );

      queryClient.setQueryData<ForumPost>(postQueryKey(postId), (old) => {
        if (!old) return old;
        return {
          ...old,
          latestComments: old.latestComments.map((c) =>
            patchCommentWithServerState(c, commentId, serverState),
          ),
        };
      });

      queryClient.setQueriesData<InfiniteData<ForumPostsPage>>(
        { queryKey: ["forum", "posts"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => {
                if (p.id !== postId) return p;
                return {
                  ...p,
                  latestComments: p.latestComments.map((c) =>
                    patchCommentWithServerState(c, commentId, serverState),
                  ),
                };
              }),
            })),
          };
        },
      );
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevComments)
        queryClient.setQueryData(
          postCommentsQueryKey(postId),
          ctx.prevComments,
        );
      if (ctx?.prevPost)
        queryClient.setQueryData(postQueryKey(postId), ctx.prevPost);
    },
  });
}
