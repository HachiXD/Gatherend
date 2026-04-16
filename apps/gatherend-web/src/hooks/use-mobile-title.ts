"use client";

import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { useCurrentBoardData } from "@/hooks/use-board-data";
import {
  useConversations,
  type FormattedConversation,
} from "@/hooks/use-conversations";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface ConversationWithProfiles {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  profileOne: FormattedConversation["profileOne"];
  profileTwo: FormattedConversation["profileTwo"];
}

/**
 * Hook para obtener el titulo actual del header mobile.
 * Retorna el nombre del canal o del otro usuario en el DM activo.
 */
export function useMobileTitle(): string | undefined {
  const context = useBoardSwitchSafe();
  const profile = useProfile();
  const { data: board } = useCurrentBoardData();
  const { conversations, isFetched: conversationsFetched } = useConversations();

  const activeConversationId = context?.currentConversationId ?? null;

  const cachedConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
  }, [activeConversationId, conversations]);

  const shouldFetchConversation = Boolean(
    activeConversationId && conversationsFetched && !cachedConversation,
  );

  const { data: fetchedConversation } = useQuery<ConversationWithProfiles>({
    queryKey: ["conversation", activeConversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${activeConversationId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },
    enabled: shouldFetchConversation,
    staleTime: 1000 * 60 * 5,
  });

  const fetchedOtherProfile = useMemo(() => {
    if (!fetchedConversation) return undefined;
    return fetchedConversation.profileOneId === profile.id
      ? fetchedConversation.profileTwo
      : fetchedConversation.profileOne;
  }, [fetchedConversation, profile.id]);

  return useMemo(() => {
    if (!context) return undefined;

    if (context.isDiscovery) return undefined;

    if (context.currentConversationId) {
      return (
        cachedConversation?.otherProfile?.username ??
        fetchedOtherProfile?.username
      );
    }

    if (context.currentChannelId && board) {
      const channel = board.channels.find(
        (ch) => ch.id === context.currentChannelId,
      );
      if (channel) return `/ ${channel.name}`;
    }

    if (context.isChannels && board) {
      return `Chats de ${board.name}`;
    }

    if (board) return board.name;

    return undefined;
  }, [context, board, cachedConversation, fetchedOtherProfile]);
}
