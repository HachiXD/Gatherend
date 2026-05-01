export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;

export const conversationQueryKey = (conversationId: string) =>
  ["conversation", conversationId] as const;

export const directMessagesQueryKey = (
  conversationId: string,
  options?: {
    cursor?: string;
    direction?: "before" | "after";
  },
) =>
  [
    "conversation",
    conversationId,
    "messages",
    options?.direction ?? "before",
    options?.cursor ?? "",
  ] as const;

export const CONVERSATIONS_STALE_TIME_MS = 1000 * 60;
export const CONVERSATIONS_GC_TIME_MS = 1000 * 60 * 5;
