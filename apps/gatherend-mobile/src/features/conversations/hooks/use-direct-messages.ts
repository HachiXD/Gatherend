import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { getDirectMessages } from "../application/get-direct-messages";
import type { DirectMessagesPage } from "../domain/direct-message";
import { directMessagesQueryKey } from "../queries";

type UseDirectMessagesOptions = {
  conversationId?: string;
  cursor?: string;
  direction?: "before" | "after";
  enabled?: boolean;
};

export function useDirectMessages({
  conversationId,
  cursor,
  direction = "before",
  enabled = true,
}: UseDirectMessagesOptions) {
  const profile = useProfile();

  return useQuery<DirectMessagesPage>({
    queryKey: conversationId
      ? directMessagesQueryKey(conversationId, { cursor, direction })
      : ["conversation", "unknown", "messages"],
    queryFn: () =>
      getDirectMessages({
        conversationId: conversationId ?? "",
        cursor,
        direction,
        profileId: profile.id,
      }),
    enabled: enabled && Boolean(conversationId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
