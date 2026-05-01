import { CHAT_MESSAGES_PAGE_SIZE, type FetchDirection } from "@/src/features/chat/types";

export const channelMessagesQueryKey = (
  boardId: string,
  channelId: string,
  options?: {
    cursor?: string;
    direction?: FetchDirection;
    limit?: number;
  },
) =>
  [
    "chat",
    "channel",
    channelId,
    "messages",
    boardId,
    options?.direction ?? "before",
    options?.cursor ?? "",
    options?.limit ?? CHAT_MESSAGES_PAGE_SIZE,
  ] as const;
