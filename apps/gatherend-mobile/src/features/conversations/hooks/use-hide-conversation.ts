import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hideConversation } from "../application/hide-conversation";
import type { Conversation } from "../domain/conversation";
import { CONVERSATIONS_QUERY_KEY } from "../queries";

type HideConversationContext = {
  previousConversations?: Conversation[];
};

export function useHideConversation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, HideConversationContext>({
    mutationFn: hideConversation,
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });

      const previousConversations =
        queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);

      queryClient.setQueryData<Conversation[]>(
        CONVERSATIONS_QUERY_KEY,
        (current) =>
          current?.filter((conversation) => conversation.id !== conversationId) ??
          [],
      );

      return { previousConversations };
    },
    onError: (_error, _conversationId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          CONVERSATIONS_QUERY_KEY,
          context.previousConversations,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
