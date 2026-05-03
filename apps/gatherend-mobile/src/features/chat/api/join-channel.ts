import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export async function joinChannel({
  boardId,
  channelId,
}: {
  boardId: string;
  channelId: string;
}) {
  const response = await nextApiFetch(
    `/api/boards/${boardId}/channels/${channelId}/join`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "Failed to join channel"));
  }
}
