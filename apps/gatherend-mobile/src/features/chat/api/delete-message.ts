import { expressFetch } from "@/src/services/express/express-fetch";

export type DeleteMessageInput = {
  messageId: string;
  boardId: string;
  channelId: string;
  profileId: string;
};

export async function deleteMessage(input: DeleteMessageInput): Promise<void> {
  const params = new URLSearchParams({
    boardId: input.boardId,
    channelId: input.channelId,
  });

  const response = await expressFetch(
    `/messages/${input.messageId}?${params.toString()}`,
    {
      method: "DELETE",
      profileId: input.profileId,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo eliminar el mensaje");
  }
}
