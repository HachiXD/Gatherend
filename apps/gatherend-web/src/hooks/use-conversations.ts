import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import axios from "axios";
import { Conversation } from "@prisma/client";
import type { UsernameColor, UsernameFormatConfig } from "../../types";
import type {
  ClientAttachmentAsset,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

type ConversationProfile = {
  id: string;
  username: string;
  email: string;
  userId: string;
  discriminator?: string;
  usernameColor?: UsernameColor;
  usernameFormat?: UsernameFormatConfig;
  avatarAsset?: ClientUploadedAsset | null;
};

interface LastMessage {
  content: string;
  attachmentAsset?: ClientAttachmentAsset | null;
  hasAttachment?: boolean;
  deleted: boolean;
  senderId: string;
}

export type FormattedConversation = Conversation & {
  profileOne: ConversationProfile;
  profileTwo: ConversationProfile;
  otherProfile: ConversationProfile;
  isOne: boolean;
  lastMessage?: LastMessage | null;
};

export const conversationsQueryKey = ["conversations"] as const;

export const useConversations = (initialData?: FormattedConversation[]) => {
  const queryClient = useQueryClient();

  const {
    data: conversations = [],
    isLoading,
    isFetched,
    error,
    refetch,
  } = useQuery({
    queryKey: conversationsQueryKey,
    queryFn: async (): Promise<FormattedConversation[]> => {
      const { data } = await axios.get("/api/conversations/list");
      return data;
    },
    initialData,
    staleTime: 1000 * 60,
  });

  const hideConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await axios.patch(`/api/conversations/${conversationId}/hide`);
      return conversationId;
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: conversationsQueryKey });

      const previousConversations = queryClient.getQueryData<
        FormattedConversation[]
      >(conversationsQueryKey);

      queryClient.setQueryData<FormattedConversation[]>(
        conversationsQueryKey,
        (old) => old?.filter((c) => c.id !== conversationId) ?? [],
      );

      return { previousConversations };
    },
    onError: (_err, _conversationId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationsQueryKey,
          context.previousConversations,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const showConversation = async (_conversationId: string) => {
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  const refreshConversations = () => {
    return queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  return {
    conversations,
    isLoading,
    isFetched,
    error,
    refetch,
    hideConversation: hideConversationMutation.mutate,
    isHiding: hideConversationMutation.isPending,
    showConversation,
    refreshConversations,
  };
};

export const useInvalidateConversations = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    return queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  return { invalidateConversations: invalidate };
};

export const useConversationProfileIds = (): string[] => {
  const { conversations } = useConversations();

  return useMemo(() => {
    if (!conversations) return [];
    return conversations
      .map((c) => c.otherProfile?.id)
      .filter((id): id is string => !!id);
  }, [conversations]);
};
