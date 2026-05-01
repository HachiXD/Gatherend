import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { chatMessageWindowStore } from "@/src/features/chat/store/chat-message-window-store";
import { sendDirectMessage } from "../application/send-direct-message";
import type { DirectMessage, DirectMessagesPage } from "../domain/direct-message";
import type { Conversation } from "../domain/conversation";
import {
  CONVERSATIONS_QUERY_KEY,
  directMessagesQueryKey,
} from "../queries";
import type { ClientSticker } from "@/src/features/chat/types";

type SendDirectMessageVariables = {
  conversationId: string;
  content: string;
  tempId: string;
  attachmentAssetId?: string;
  sticker?: ClientSticker;
};

type SendDirectMessageContext = {
  previousPage?: DirectMessagesPage;
  queryKey: ReturnType<typeof directMessagesQueryKey>;
  tempId: string;
  windowKey?: string;
};

export function createTempDirectMessageId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createOptimisticDirectMessage({
  conversationId,
  content,
  profile,
  tempId,
  attachmentAssetId,
  sticker,
}: {
  conversationId: string;
  content: string;
  profile: ReturnType<typeof useProfile>;
  tempId: string;
  attachmentAssetId?: string;
  sticker?: ClientSticker | null;
}): DirectMessage {
  const now = new Date().toISOString();

  return {
    id: tempId,
    tempId,
    isOptimistic: true,
    content,
    attachmentAssetId: attachmentAssetId ?? null,
    attachmentAsset: null,
    conversationId,
    senderId: profile.id,
    sender: {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      usernameColor: profile.usernameColor,
      profileTags: profile.profileTags,
      badge: profile.badge,
      usernameFormat: profile.usernameFormat,
      chatBubbleStyle: profile.chatBubbleStyle,
      avatarAsset: profile.avatarAsset,
      badgeSticker: profile.badgeSticker
        ? {
            id: profile.badgeSticker.id,
            asset: profile.badgeSticker.asset,
          }
        : null,
    },
    stickerId: sticker?.id ?? null,
    sticker: sticker ?? null,
    deleted: false,
    pinned: false,
    pinnedAt: null,
    createdAt: now,
    updatedAt: now,
    reactions: [],
    replyTo: null,
    filePreviewUrl: null,
    fileStaticPreviewUrl: null,
  };
}

export function useSendDirectMessage(windowKey?: string) {
  const queryClient = useQueryClient();
  const profile = useProfile();

  return useMutation<
    DirectMessage,
    Error,
    SendDirectMessageVariables,
    SendDirectMessageContext
  >({
    mutationFn: ({ conversationId, content, tempId, attachmentAssetId, sticker }) =>
      sendDirectMessage({
        conversationId,
        content: content.trim(),
        profileId: profile.id,
        tempId,
        attachmentAssetId,
        stickerId: sticker?.id,
      }),
    onMutate: async ({
      conversationId,
      content,
      tempId,
      attachmentAssetId,
      sticker,
    }) => {
      const queryKey = directMessagesQueryKey(conversationId);

      await queryClient.cancelQueries({ queryKey });

      const previousPage = queryClient.getQueryData<DirectMessagesPage>(queryKey);
      const optimisticMessage = createOptimisticDirectMessage({
        conversationId,
        content: content.trim(),
        profile,
        tempId,
        attachmentAssetId,
        sticker,
      });

      if (windowKey) {
        chatMessageWindowStore.upsertIncomingMessage(windowKey, optimisticMessage);
      }

      queryClient.setQueryData<DirectMessagesPage>(queryKey, (current) => ({
        items: [optimisticMessage, ...(current?.items ?? [])],
        nextCursor: current?.nextCursor ?? null,
        previousCursor: current?.previousCursor ?? null,
      }));

      queryClient.setQueryData<Conversation[]>(
        CONVERSATIONS_QUERY_KEY,
        (current) =>
          current?.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  updatedAt: new Date().toISOString(),
                  lastMessage: {
                    content: content.trim(),
                    deleted: false,
                    senderId: profile.id,
                    hasAttachment: Boolean(attachmentAssetId),
                    stickerName: sticker?.name ?? null,
                  },
                }
              : conversation,
          ),
      );

      return { previousPage, queryKey, tempId, windowKey };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        if (context.windowKey) {
          chatMessageWindowStore.removeById(context.windowKey, context.tempId);
        }
        queryClient.setQueryData(context.queryKey, context.previousPage);
      }
    },
    onSuccess: (serverMessage, _variables, context) => {
      if (!context) return;

      if (context.windowKey) {
        chatMessageWindowStore.replaceOptimisticByTempId(
          context.windowKey,
          context.tempId,
          serverMessage,
        );
      }

      queryClient.setQueryData<DirectMessagesPage>(context.queryKey, (current) => {
        if (!current) {
          return {
            items: [serverMessage],
            nextCursor: null,
            previousCursor: null,
          };
        }

        return {
          ...current,
          items: current.items.map((message) =>
            message.tempId === context.tempId || message.id === context.tempId
              ? serverMessage
              : message,
          ),
        };
      });
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: directMessagesQueryKey(variables.conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
