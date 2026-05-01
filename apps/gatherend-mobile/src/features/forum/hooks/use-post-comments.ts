import { useQuery } from "@tanstack/react-query";
import { getPostComments } from "../application/get-post-comments";
import {
  FORUM_COMMENTS_GC_TIME_MS,
  FORUM_COMMENTS_STALE_TIME_MS,
  postCommentsQueryKey,
} from "../queries";

export function usePostComments(postId: string | null) {
  return useQuery({
    queryKey: postCommentsQueryKey(postId ?? ""),
    queryFn: () => getPostComments(postId!),
    staleTime: FORUM_COMMENTS_STALE_TIME_MS,
    gcTime: FORUM_COMMENTS_GC_TIME_MS,
    enabled: !!postId,
  });
}
