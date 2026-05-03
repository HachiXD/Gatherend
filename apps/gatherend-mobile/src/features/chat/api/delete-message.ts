import { expressFetch } from "@/src/services/express/express-fetch";

export type DeleteMessageInput = {
  messageId: string;
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

export async function deleteMessage(input: DeleteMessageInput): Promise<void> {
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
      method: "DELETE",
      profileId: input.profileId,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo eliminar el mensaje");
  }
}
