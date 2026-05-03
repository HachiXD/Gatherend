import { expressFetch } from "@/src/services/express/express-fetch";
import type { ChannelMessage } from "../types";
import type { DirectMessage } from "@/src/features/conversations/domain/direct-message";

export type EditMessageInput = {
  messageId: string;
  content: string;
  profileId: string;
} & (
  | {
      type: "channel";
      boardId: string;
      channelId: string;
    }
  | {
      type: "conversation";
      conversationId: string;
    }
);

export async function editMessage(
  input: EditMessageInput,
): Promise<ChannelMessage | DirectMessage> {
  const params =
    input.type === "channel"
      ? new URLSearchParams({
          boardId: input.boardId,
          channelId: input.channelId,
        })
      : new URLSearchParams({
          conversationId: input.conversationId,
        });

  const response = await expressFetch(
    `/${input.type === "channel" ? "messages" : "direct-messages"}/${input.messageId}?${params.toString()}`,
    {
      method: "PATCH",
      profileId: input.profileId,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.content }),
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo editar el mensaje");
  }

  return (await response.json()) as ChannelMessage | DirectMessage;
}
