import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { ClientProfile } from "../types/current-profile";

export async function getCurrentProfile() {
  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/profile/me`, {
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
        : "Failed to fetch profile",
    );
  }

  return (await response.json()) as ClientProfile;
}
