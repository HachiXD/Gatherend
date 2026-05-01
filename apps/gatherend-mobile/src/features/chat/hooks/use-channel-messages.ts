import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { getChannelMessages } from "@/src/features/chat/api/get-channel-messages";
import { channelMessagesQueryKey } from "@/src/features/chat/queries";
import {
  CHAT_MESSAGES_PAGE_SIZE,
  type ChatPage,
  type FetchDirection,
} from "@/src/features/chat/types";

type UseChannelMessagesOptions = {
  boardId?: string;
  channelId?: string;
  cursor?: string;
  direction?: FetchDirection;
  enabled?: boolean;
  limit?: number;
};

export function useChannelMessages({
  boardId,
  channelId,
  cursor,
  direction = "before",
  enabled = true,
  limit = CHAT_MESSAGES_PAGE_SIZE,
}: UseChannelMessagesOptions) {
  const profile = useProfile();
  const hasRequiredIds = Boolean(boardId && channelId);

  return useQuery<ChatPage>({
    queryKey:
      boardId && channelId
        ? channelMessagesQueryKey(boardId, channelId, {
            cursor,
            direction,
            limit,
          })
        : ["chat", "channel", "unknown"],
    queryFn: async () =>
      getChannelMessages({
        boardId: boardId ?? "",
        channelId: channelId ?? "",
        profileId: profile.id,
        cursor,
        direction,
        limit,
      }),
    enabled: enabled && hasRequiredIds,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
