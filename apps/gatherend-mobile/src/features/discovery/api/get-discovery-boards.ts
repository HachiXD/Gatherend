import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import {
  DISCOVERY_BOARDS_PAGE_SIZE,
} from "@/src/features/discovery/queries";
import type { DiscoveryBoardsPage } from "@/src/features/discovery/types";

type GetDiscoveryBoardsInput = {
  cursor?: string | null;
  limit?: number;
};

export async function getDiscoveryBoards({
  cursor,
  limit = DISCOVERY_BOARDS_PAGE_SIZE,
}: GetDiscoveryBoardsInput = {}) {
  const cookie = authClient.getCookie();
  const searchParams = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  const response = await fetch(
    `${authBaseUrl}/api/discovery/boards?${searchParams.toString()}`,
    {
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
        : "Failed to fetch discovery boards",
    );
  }

  return (await response.json()) as DiscoveryBoardsPage;
}
