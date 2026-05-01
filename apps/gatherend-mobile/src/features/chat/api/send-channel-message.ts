import { expressFetch } from "@/src/services/express/express-fetch";
import type { ChannelMessage } from "@/src/features/chat/types";

export type SendChannelMessageInput = {
  boardId: string;
  channelId: string;
  profileId: string;
  content: string;
  tempId: string;
  attachmentAssetId?: string;
  stickerId?: string;
  replyToMessageId?: string;
};

export async function sendChannelMessage({
  boardId,
  channelId,
  profileId,
  content,
  tempId,
  attachmentAssetId,
  stickerId,
  replyToMessageId,
}: SendChannelMessageInput) {
  const searchParams = new URLSearchParams({
    boardId,
    channelId,
  });

  const response = await expressFetch(`/messages?${searchParams.toString()}`, {
    method: "POST",
    profileId,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      tempId,
      attachmentAssetId,
      stickerId,
      replyToMessageId,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));

    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to send channel message",
    );
  }

  return (await response.json()) as ChannelMessage;
}
