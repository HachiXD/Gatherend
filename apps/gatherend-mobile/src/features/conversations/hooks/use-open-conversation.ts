import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { createConversation } from "../api/create-conversation";

export function useOpenConversation() {
  const router = useRouter();

  return useMutation({
    mutationFn: createConversation,
    onSuccess: ({ id }) => {
      router.push({
        pathname: "/(app)/(tabs)/chats/[conversationId]",
        params: { conversationId: id },
      });
    },
  });
}
