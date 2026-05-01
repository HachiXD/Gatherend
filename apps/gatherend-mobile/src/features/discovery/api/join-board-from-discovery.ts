import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { JoinBoardFromDiscoveryResponse } from "@/src/features/discovery/types";

export async function joinBoardFromDiscovery(boardId: string) {
  const cookie = authClient.getCookie();
  const response = await fetch(
    `${authBaseUrl}/api/boards/${boardId}/join?source=discovery`,
    {
      method: "POST",
      headers: cookie
        ? {
            Cookie: cookie,
          }
        : undefined,
      credentials: "omit",
    },
  );

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));

    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to join board from discovery",
    );
  }

  return (await response.json()) as JoinBoardFromDiscoveryResponse;
}
