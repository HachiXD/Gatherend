import type { QueryClient } from "@tanstack/react-query";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import type { ClientProfile } from "@/hooks/use-current-profile";

export const CURRENT_PROFILE_QUERY_KEY = ["current-profile"] as const;

export async function fetchCurrentProfile() {
  const response = await fetchWithRetry("/api/profile/me");

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error("Failed to fetch profile");
  }

  return response.json() as Promise<ClientProfile>;
}

export function removeCurrentProfileCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: CURRENT_PROFILE_QUERY_KEY });
}

export async function prefetchCurrentProfile(queryClient: QueryClient) {
  removeCurrentProfileCache(queryClient);

  await queryClient.prefetchQuery<ClientProfile>({
    queryKey: CURRENT_PROFILE_QUERY_KEY,
    queryFn: fetchCurrentProfile,
    staleTime: 1000 * 60 * 5,
  });
}
