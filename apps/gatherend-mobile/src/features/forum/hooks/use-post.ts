import { useQuery } from "@tanstack/react-query";
import { getPost } from "../application/get-post";
import { FORUM_POSTS_GC_TIME_MS, FORUM_POSTS_STALE_TIME_MS, postQueryKey } from "../queries";

export function usePost(boardId: string | undefined, postId: string | undefined) {
  console.log("[usePost] boardId:", boardId, "postId:", postId);
  return useQuery({
    queryKey: postQueryKey(postId ?? ""),
    queryFn: () => getPost(boardId!, postId!),
    staleTime: FORUM_POSTS_STALE_TIME_MS,
    gcTime: FORUM_POSTS_GC_TIME_MS,
    enabled: !!boardId && !!postId,
  });
}
