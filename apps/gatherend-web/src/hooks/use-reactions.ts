"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

interface AddReactionVariables {
  emoji: string;
  messageId?: string;
  directMessageId?: string;
  profileId: string;
  channelId?: string;
  conversationId?: string;
}

interface RemoveReactionVariables {
  reactionId: string;
  profileId: string;
  channelId?: string;
  conversationId?: string;
}

export const useAddReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      emoji,
      messageId,
      directMessageId,
      profileId,
      channelId,
      conversationId,
    }: AddReactionVariables) => {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/reactions`,
        {
          emoji,
          messageId,
          directMessageId,
          channelId,
          conversationId,
        },
        getExpressAxiosConfig(profileId)
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refetch messages with updated reactions
      if (variables.channelId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "channel", variables.channelId],
        });
      }
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "conversation", variables.conversationId],
        });
      }
    },
    onError: (error) => {
      console.error("[useAddReaction] Error:", error);
    },
  });
};

export const useRemoveReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reactionId,
      profileId,
      channelId,
      conversationId,
    }: RemoveReactionVariables) => {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/reactions/${reactionId}`,
        {
          ...getExpressAxiosConfig(profileId),
          data: {
            channelId,
            conversationId,
          },
        }
      );
    },
    onSuccess: (_, variables) => {
      if (variables.channelId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "channel", variables.channelId],
        });
      }
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "conversation", variables.conversationId],
        });
      }
    },
  });
};

