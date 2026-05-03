import type { QueryClient } from "@tanstack/react-query";
import { getCurrentProfile } from "@/src/features/profile/api/get-current-profile";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";

export const CURRENT_PROFILE_QUERY_KEY = ["current-profile"] as const;

export function removeCurrentProfileCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: CURRENT_PROFILE_QUERY_KEY });
}

export async function prefetchCurrentProfile(queryClient: QueryClient) {
  removeCurrentProfileCache(queryClient);

  await queryClient.prefetchQuery<ClientProfile>({
    queryKey: CURRENT_PROFILE_QUERY_KEY,
    queryFn: getCurrentProfile,
    staleTime: 1000 * 60 * 5,
  });
}
