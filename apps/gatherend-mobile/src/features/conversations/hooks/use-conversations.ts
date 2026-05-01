import { useQuery } from "@tanstack/react-query";
import { getConversations } from "../application/get-conversations";
import type { Conversation } from "../domain/conversation";
import {
  CONVERSATIONS_GC_TIME_MS,
  CONVERSATIONS_QUERY_KEY,
  CONVERSATIONS_STALE_TIME_MS,
} from "../queries";

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: getConversations,
    staleTime: CONVERSATIONS_STALE_TIME_MS,
    gcTime: CONVERSATIONS_GC_TIME_MS,
  });
}
