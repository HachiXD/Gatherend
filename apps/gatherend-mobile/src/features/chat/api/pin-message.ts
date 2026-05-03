import { expressFetch } from "@/src/services/express/express-fetch";

export type PinMessageInput = {
  messageId: string;
  profileId: string;
  pin: boolean;
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

export async function pinMessage(input: PinMessageInput): Promise<void> {
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
    `/${input.type === "channel" ? "messages" : "direct-messages"}/${input.messageId}/pin?${params.toString()}`,
    {
      method: input.pin ? "POST" : "DELETE",
      profileId: input.profileId,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo cambiar el pin del mensaje");
  }
}
