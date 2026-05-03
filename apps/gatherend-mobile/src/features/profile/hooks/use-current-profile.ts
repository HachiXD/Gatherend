import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { getCurrentProfile } from "@/src/features/profile/api/get-current-profile";
import { CURRENT_PROFILE_QUERY_KEY } from "@/src/features/profile/lib/current-profile-cache";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";

export function useCurrentProfile() {
  const { session, isPending, isAuthenticated } = useSession();

  return useQuery<ClientProfile>({
    queryKey: CURRENT_PROFILE_QUERY_KEY,
    queryFn: async () => {
      if (isPending) {
        throw new Error("Auth not loaded");
      }

      if (!isAuthenticated || !session?.user?.id) {
        throw new Error("Not signed in");
      }

      return getCurrentProfile();
    },
    enabled: !isPending && isAuthenticated,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    retry: false,
  });
}
