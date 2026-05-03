import { expressFetch } from "@/src/services/express/express-fetch";
import type { ChatReaction } from "../types";

export type AddReactionInput = {
  emoji: string;
  profileId: string;
} & (
  | {
      messageId: string;
      boardId: string;
      channelId: string;
    }
  | {
      directMessageId: string;
      conversationId: string;
    }
);

export async function addReaction(input: AddReactionInput): Promise<ChatReaction> {
  const response = await expressFetch("/reactions", {
    method: "POST",
    profileId: input.profileId,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emoji: input.emoji,
      ...("messageId" in input
        ? {
            messageId: input.messageId,
            boardId: input.boardId,
            channelId: input.channelId,
          }
        : {
            directMessageId: input.directMessageId,
            conversationId: input.conversationId,
          }),
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo agregar la reacción");
  }

  return (await response.json()) as ChatReaction;
}
