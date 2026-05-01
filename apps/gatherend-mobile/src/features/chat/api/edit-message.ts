import { expressFetch } from "@/src/services/express/express-fetch";
import type { ChannelMessage } from "../types";

export type EditMessageInput = {
  messageId: string;
  content: string;
  boardId: string;
  channelId: string;
  profileId: string;
};

export async function editMessage(input: EditMessageInput): Promise<ChannelMessage> {
  const params = new URLSearchParams({
    boardId: input.boardId,
    channelId: input.channelId,
  });

  const response = await expressFetch(
    `/messages/${input.messageId}?${params.toString()}`,
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

  return (await response.json()) as ChannelMessage;
}
