import { expressFetch } from "@/src/services/express/express-fetch";

export async function joinChannel({
  boardId,
  channelId,
  profileId,
}: {
  boardId: string;
  channelId: string;
  profileId: string;
}) {
  const response = await expressFetch(
    `/boards/${boardId}/channels/${channelId}/join`,
    {
      method: "POST",
      profileId,
    },
  );

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));

    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to join channel",
    );
  }
}
