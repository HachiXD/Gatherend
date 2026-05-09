import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createPost } from "../application/create-post";
import { boardPostsQueryKey } from "../queries";
import type { ForumPostsPage } from "../domain/post";

export function useCreatePost(boardId: string, channelId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPost,
    onSuccess: (newPost) => {
      const normalizedPost = {
        ...newPost,
        latestComments: newPost.latestComments ?? [],
        commentCount: newPost.commentCount ?? 0,
      };
      queryClient.setQueryData<InfiniteData<ForumPostsPage>>(
        boardPostsQueryKey(boardId, channelId),
        (current) => {
          if (!current) return current;
          const [firstPage, ...rest] = current.pages;
          return {
            ...current,
            pages: [
              { ...firstPage, items: [normalizedPost, ...firstPage.items] },
              ...rest,
            ],
          };
        },
      );
    },
  });
}
