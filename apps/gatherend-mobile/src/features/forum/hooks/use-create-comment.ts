import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { createComment } from "../application/create-comment";
import {
  boardPostsQueryKey,
  postCommentsQueryKey,
  postQueryKey,
} from "../queries";
import type {
  ForumPost,
  ForumPostComment,
  ForumPostCommentsResult,
  ForumPostsPage,
} from "../domain/post";

type CreateCommentInput = {
  postId: string;
  content: string;
  imageAssetId?: string | null;
  replyToCommentId?: string | null;
};

function upsertLatestComment(
  latestComments: ForumPostComment[],
  nextComment: ForumPostComment,
  optimisticId?: string,
) {
  const withoutPrevious = latestComments.filter(
    (comment) => comment.id !== optimisticId && comment.id !== nextComment.id,
  );

  return [...withoutPrevious, nextComment].slice(-5);
}

export function useCreateComment(boardId: string) {
  const queryClient = useQueryClient();
  const profile = useProfile();

  return useMutation({
    mutationFn: createComment,
    onMutate: async ({
      postId,
      content,
      imageAssetId,
      replyToCommentId,
    }: CreateCommentInput) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: boardPostsQueryKey(boardId) }),
        queryClient.cancelQueries({ queryKey: postQueryKey(postId) }),
        queryClient.cancelQueries({ queryKey: postCommentsQueryKey(postId) }),
      ]);

      const previousPosts = queryClient.getQueryData<
        InfiniteData<ForumPostsPage>
      >(boardPostsQueryKey(boardId));
      const previousPost = queryClient.getQueryData<ForumPost>(
        postQueryKey(postId),
      );
      const previousComments =
        queryClient.getQueryData<ForumPostCommentsResult>(
          postCommentsQueryKey(postId),
        );

      const optimisticId = `optimistic-comment:${postId}:${Date.now()}`;
      const nowIso = new Date().toISOString();

      const optimisticReplyTarget =
        previousComments?.items.find(
          (comment) => comment.id === replyToCommentId,
        ) ??
        previousPost?.latestComments.find(
          (comment) => comment.id === replyToCommentId,
        ) ??
        null;

      const optimisticComment: ForumPostComment = {
        id: optimisticId,
        postId,
        content,
        deleted: false,
        likeCount: 0,
        isLikedByCurrentUser: false,
        imageAsset: imageAssetId
          ? {
              id: imageAssetId,
              url: "",
              mimeType: "image/jpeg",
              width: null,
              height: null,
              size: null,
              blurDataUrl: null,
            }
          : null,
        createdAt: nowIso,
        updatedAt: nowIso,
        author: {
          id: profile.id,
          username: profile.username,
          discriminator: profile.discriminator ?? null,
          usernameColor: profile.usernameColor,
          usernameFormat: profile.usernameFormat,
          badge: profile.badge,
          avatarAsset: profile.avatarAsset,
          badgeSticker: profile.badgeSticker
            ? {
                id: profile.badgeSticker.id,
                name: profile.badgeSticker.name,
                asset: profile.badgeSticker.asset,
              }
            : null,
        },
        replyToCommentId: replyToCommentId ?? null,
        replyToComment: optimisticReplyTarget
          ? {
              id: optimisticReplyTarget.id,
              content: optimisticReplyTarget.content,
              deleted: optimisticReplyTarget.deleted,
              createdAt: optimisticReplyTarget.createdAt,
              author: {
                id: optimisticReplyTarget.author.id,
                username: optimisticReplyTarget.author.username,
                discriminator: optimisticReplyTarget.author.discriminator,
              },
            }
          : null,
      };

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
                  latestComments: upsertLatestComment(
                    post.latestComments,
                    optimisticComment,
                  ),
                };
              }),
            })),
          };
        },
      );

      queryClient.setQueryData<ForumPost>(postQueryKey(postId), (current) => {
        if (!current) return current;
        return {
          ...current,
          commentCount: current.commentCount + 1,
          latestComments: upsertLatestComment(
            current.latestComments,
            optimisticComment,
          ),
        };
      });

      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                totalCount: current.totalCount + 1,
                items: [...current.items, optimisticComment],
              }
            : current,
      );

      return { previousPosts, previousPost, previousComments, optimisticId };
    },
    onSuccess: (newComment, { postId }, context) => {
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
                  commentCount: post.commentCount,
                  latestComments: upsertLatestComment(
                    post.latestComments,
                    newComment,
                    context?.optimisticId,
                  ),
                };
              }),
            })),
          };
        },
      );

      queryClient.setQueryData<ForumPost>(postQueryKey(postId), (current) => {
        if (!current) return current;
        return {
          ...current,
          commentCount: current.commentCount,
          latestComments: upsertLatestComment(
            current.latestComments,
            newComment,
            context?.optimisticId,
          ),
        };
      });

      queryClient.setQueryData<ForumPostCommentsResult>(
        postCommentsQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                totalCount: current.totalCount,
                items: [
                  ...current.items.filter(
                    (comment) => comment.id !== context?.optimisticId,
                  ),
                  newComment,
                ],
              }
            : current,
      );
    },
    onError: (_error, { postId }, context) => {
      if (!context) return;

      if (context.previousPosts) {
        queryClient.setQueryData(
          boardPostsQueryKey(boardId),
          context.previousPosts,
        );
      }

      if (context.previousPost) {
        queryClient.setQueryData(postQueryKey(postId), context.previousPost);
      }

      if (context.previousComments) {
        queryClient.setQueryData(
          postCommentsQueryKey(postId),
          context.previousComments,
        );
      }
    },
  });
}
