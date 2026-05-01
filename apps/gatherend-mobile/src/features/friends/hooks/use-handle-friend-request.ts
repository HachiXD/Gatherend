import { useMutation, useQueryClient } from "@tanstack/react-query";
import { handleFriendRequest } from "../api/handle-friend-request";

export function useHandleFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      friendshipId,
      action,
    }: {
      friendshipId: string;
      action: "accept" | "reject";
    }) => handleFriendRequest(friendshipId, action),
    onSuccess: (_, { action }) => {
      void queryClient.invalidateQueries({
        queryKey: ["friendRequests", "pending"],
      });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      if (action === "accept") {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
  });
}
