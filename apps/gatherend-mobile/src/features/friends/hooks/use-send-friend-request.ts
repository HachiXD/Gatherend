import { useMutation } from "@tanstack/react-query";
import { sendFriendRequest } from "../api/send-friend-request";

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: (name: string) => sendFriendRequest(name),
  });
}
