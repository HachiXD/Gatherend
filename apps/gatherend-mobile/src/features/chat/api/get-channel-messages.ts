import { expressFetch } from "@/src/services/express/express-fetch";
import {
  CHAT_MESSAGES_PAGE_SIZE,
  type ChatPage,
  type FetchDirection,
} from "@/src/features/chat/types";

export type GetChannelMessagesInput = {
  boardId: string;
  channelId: string;
  profileId: string;
  cursor?: string;
  direction?: FetchDirection;
  limit?: number;
};

export async function getChannelMessages({
  boardId,
  channelId,
  profileId,
  cursor,
  direction = "before",
  limit = CHAT_MESSAGES_PAGE_SIZE,
}: GetChannelMessagesInput) {
  const searchParams = new URLSearchParams({
    boardId,
    channelId,
    limit: String(limit),
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
    searchParams.set("direction", direction);
  }

  const response = await expressFetch(`/messages?${searchParams.toString()}`, {
    profileId,
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));

    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to fetch channel messages",
    );
  }

  return (await response.json()) as ChatPage;
}
