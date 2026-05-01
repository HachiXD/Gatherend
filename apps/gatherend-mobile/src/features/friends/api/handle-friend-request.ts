import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";

export async function handleFriendRequest(
  friendshipId: string,
  action: "accept" | "reject",
): Promise<void> {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/friends/${friendshipId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    credentials: "omit",
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data?.error === "string" ? data.error : "Request failed",
    );
  }
}
