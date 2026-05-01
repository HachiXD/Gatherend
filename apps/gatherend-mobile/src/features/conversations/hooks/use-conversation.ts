import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { getConversation } from "../application/get-conversation";
import type { Conversation } from "../domain/conversation";
import {
  CONVERSATIONS_QUERY_KEY,
  conversationQueryKey,
  CONVERSATIONS_GC_TIME_MS,
  CONVERSATIONS_STALE_TIME_MS,
} from "../queries";

export function useConversation(conversationId?: string) {
  const profile = useProfile();
  const queryClient = useQueryClient();
  const cachedConversation = queryClient
    .getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY)
    ?.find((conversation) => conversation.id === conversationId);

  return useQuery<Conversation>({
    queryKey: conversationId
      ? conversationQueryKey(conversationId)
      : ["conversation", "unknown"],
    queryFn: () => getConversation(conversationId ?? "", profile.id),
    enabled: Boolean(conversationId) && !cachedConversation,
    initialData: cachedConversation,
    staleTime: CONVERSATIONS_STALE_TIME_MS,
    gcTime: CONVERSATIONS_GC_TIME_MS,
  });
}
