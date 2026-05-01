export const boardPostsQueryKey = (boardId: string) =>
  ["forum", "posts", boardId] as const;

export const postCommentsQueryKey = (postId: string) =>
  ["forum", "comments", postId] as const;

export const FORUM_POSTS_STALE_TIME_MS = 1000 * 30;
export const FORUM_POSTS_GC_TIME_MS = 1000 * 60 * 5;

export const FORUM_COMMENTS_STALE_TIME_MS = 1000 * 60 * 5;
export const FORUM_COMMENTS_GC_TIME_MS = 1000 * 60 * 10;
