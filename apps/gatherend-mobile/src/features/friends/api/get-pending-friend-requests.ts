import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { PendingFriendRequest } from "../types";

export async function getPendingFriendRequests(): Promise<PendingFriendRequest[]> {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/friends/pending`, {
    headers: cookie ? { Cookie: cookie } : undefined,
    credentials: "omit",
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Failed to fetch pending requests",
    );
  }

  return (await response.json()) as PendingFriendRequest[];
}
