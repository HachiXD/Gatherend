import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { BoardChannel } from "../types/board";

export type UpdateChannelInput = {
  boardId: string;
  channelId: string;
  name: string;
};

export async function updateChannel(input: UpdateChannelInput): Promise<BoardChannel> {
  const cookie = authClient.getCookie();
  const response = await fetch(
    `${authBaseUrl}/api/boards/${input.boardId}/channels/${input.channelId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      credentials: "omit",
      body: JSON.stringify({ name: input.name }),
    },
  );

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error", message: undefined }));

    if (
      typeof errorPayload?.message === "string" &&
      errorPayload.message.length > 0
    ) {
      throw new Error(errorPayload.message);
    }
    throw new Error("Error al actualizar el canal");
  }

  return response.json() as Promise<BoardChannel>;
}
