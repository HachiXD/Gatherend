import { expressFetch } from "@/src/services/express/express-fetch";

export type PinMessageInput = {
  messageId: string;
  boardId: string;
  channelId: string;
  profileId: string;
  pin: boolean;
};

export async function pinMessage(input: PinMessageInput): Promise<void> {
  const params = new URLSearchParams({
    boardId: input.boardId,
    channelId: input.channelId,
  });

  const response = await expressFetch(
    `/messages/${input.messageId}/pin?${params.toString()}`,
    {
      method: input.pin ? "POST" : "DELETE",
      profileId: input.profileId,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo cambiar el pin del mensaje");
  }
}
