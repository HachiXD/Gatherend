import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { BoardWithData } from "../types/board";

export async function getBoard(boardId: string) {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/boards/${boardId}`, {
    headers: cookie
      ? {
          Cookie: cookie,
        }
      : undefined,
    credentials: "omit",
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));

    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to fetch board",
    );
  }

  return (await response.json()) as BoardWithData;
}
