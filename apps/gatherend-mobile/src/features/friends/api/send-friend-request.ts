import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";

type SendFriendRequestResponse = {
  success: boolean;
  message: string;
};

export async function sendFriendRequest(
  name: string,
): Promise<SendFriendRequestResponse> {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/friends/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    credentials: "omit",
    body: JSON.stringify({ name }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "No se pudo enviar la solicitud",
    );
  }

  return data as SendFriendRequestResponse;
}
