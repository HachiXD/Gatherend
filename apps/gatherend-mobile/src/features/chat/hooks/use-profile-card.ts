import { useQuery } from "@tanstack/react-query";
import { getProfileCard } from "../api/get-profile-card";

export function useProfileCard(
  profileId: string | null,
  currentProfileId: string,
  enabled = false,
) {
  return useQuery({
    queryKey: ["profile-card", profileId],
    queryFn: () => getProfileCard(profileId!, currentProfileId),
    enabled: enabled && !!profileId && !!currentProfileId,
    staleTime: 5 * 1000,
    gcTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
