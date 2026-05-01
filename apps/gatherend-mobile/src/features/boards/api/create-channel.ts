import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { BoardChannel, BoardChannelType } from "../types/board";

export type CreateChannelInput = {
  boardId: string;
  name: string;
  type: BoardChannelType;
  imageAssetId?: string | null;
};

export async function createChannel(input: CreateChannelInput) {
  const cookie = authClient.getCookie();
  const response = await fetch(
    `${authBaseUrl}/api/boards/${input.boardId}/channels`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      credentials: "omit",
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        imageAssetId: input.imageAssetId ?? undefined,
      }),
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

    if (
      typeof errorPayload?.error === "string" &&
      errorPayload.error.length > 0
    ) {
      throw new Error(errorPayload.error);
    }

    throw new Error("No se pudo crear el canal");
  }

  return (await response.json()) as BoardChannel;
}
