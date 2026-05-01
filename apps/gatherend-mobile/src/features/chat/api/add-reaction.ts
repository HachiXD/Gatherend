import { expressFetch } from "@/src/services/express/express-fetch";
import type { ChatReaction } from "../types";

export type AddReactionInput = {
  messageId: string;
  emoji: string;
  boardId: string;
  channelId: string;
  profileId: string;
};

export async function addReaction(input: AddReactionInput): Promise<ChatReaction> {
  const response = await expressFetch("/reactions", {
    method: "POST",
    profileId: input.profileId,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emoji: input.emoji,
      messageId: input.messageId,
      boardId: input.boardId,
      channelId: input.channelId,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo agregar la reacción");
  }

  return (await response.json()) as ChatReaction;
}
