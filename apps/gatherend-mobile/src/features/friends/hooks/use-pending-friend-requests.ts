import { useQuery } from "@tanstack/react-query";
import { getPendingFriendRequests } from "../api/get-pending-friend-requests";

export function usePendingFriendRequests(enabled = true) {
  return useQuery({
    queryKey: ["friendRequests", "pending"],
    queryFn: getPendingFriendRequests,
    enabled,
    staleTime: 1000 * 30,
  });
}
