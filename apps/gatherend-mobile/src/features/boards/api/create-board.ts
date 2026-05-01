import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { CreateBoardInput, CreatedBoard } from "../types/board";

export async function createBoard(input: CreateBoardInput) {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/boards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    credentials: "omit",
    body: JSON.stringify({
      name: input.name,
      description: input.description?.trim() || undefined,
      imageAssetId: input.imageAssetId ?? undefined,
      bannerAssetId: input.bannerAssetId ?? undefined,
      isPrivate: input.isPrivate === false ? false : true,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error", message: undefined }));

    if (typeof errorPayload?.message === "string" && errorPayload.message.length > 0) {
      throw new Error(errorPayload.message);
    }

    if (typeof errorPayload?.error === "string" && errorPayload.error.length > 0) {
      throw new Error(errorPayload.error);
    }

    throw new Error("No se pudo crear el board");
  }

  return (await response.json()) as CreatedBoard;
}
