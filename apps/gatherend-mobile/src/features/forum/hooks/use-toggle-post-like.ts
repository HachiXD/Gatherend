import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { nextApiFetch } from "@/src/services/next-api/next-api-fetch";
import {
  boardPostsQueryKey,
  boardPostPreviewsQueryKey,
  postQueryKey,
} from "../queries";
import type {
  ForumPost,
  ForumPostPreview,
  ForumPostsPage,
  ForumPostPreviewsPage,
} from "../domain/post";

async function togglePostLike(postId: string, isLiked: boolean): Promise<void> {
  const method = isLiked ? "DELETE" : "POST";
  await nextApiFetch(`/api/posts/${postId}/likes`, { method });
}

export function useTogglePostLike(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      togglePostLike(postId, isLiked),

    onMutate: async ({ postId, isLiked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: postQueryKey(postId) }),
        queryClient.cancelQueries({ queryKey: boardPostsQueryKey(boardId) }),
        queryClient.cancelQueries({
          queryKey: boardPostPreviewsQueryKey(boardId),
        }),
      ]);

      const prevPost = queryClient.getQueryData<ForumPost>(
        postQueryKey(postId),
      );
      const prevPostsList = queryClient.getQueryData<
        InfiniteData<ForumPostsPage>
      >(boardPostsQueryKey(boardId));
      const prevPreviews = queryClient.getQueryData<
        InfiniteData<ForumPostPreviewsPage>
      >(boardPostPreviewsQueryKey(boardId));

      const delta = isLiked ? -1 : 1;

      queryClient.setQueryData<ForumPost>(postQueryKey(postId), (old) => {
        if (!old) return old;
        return {
          ...old,
          isLikedByCurrentUser: !isLiked,
          likeCount: Math.max(0, old.likeCount + delta),
        };
      });

      const updatePost = (post: ForumPost): ForumPost =>
        post.id === postId
          ? {
              ...post,
              isLikedByCurrentUser: !isLiked,
              likeCount: Math.max(0, post.likeCount + delta),
            }
          : post;

      queryClient.setQueryData<InfiniteData<ForumPostsPage>>(
        boardPostsQueryKey(boardId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.map(updatePost),
            })),
          };
        },
      );

      const updatePreview = (post: ForumPostPreview): ForumPostPreview =>
        post.id === postId
          ? {
              ...post,
              isLikedByCurrentUser: !isLiked,
              likeCount: Math.max(0, post.likeCount + delta),
            }
          : post;

      queryClient.setQueryData<InfiniteData<ForumPostPreviewsPage>>(
        boardPostPreviewsQueryKey(boardId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.map(updatePreview),
            })),
          };
        },
      );

      return { prevPost, prevPostsList, prevPreviews };
    },

    onError: (_err, { postId }, ctx) => {
      if (!ctx) return;
      if (ctx.prevPost)
        queryClient.setQueryData(postQueryKey(postId), ctx.prevPost);
      if (ctx.prevPostsList)
        queryClient.setQueryData(
          boardPostsQueryKey(boardId),
          ctx.prevPostsList,
        );
      if (ctx.prevPreviews)
        queryClient.setQueryData(
          boardPostPreviewsQueryKey(boardId),
          ctx.prevPreviews,
        );
    },
  });
}
