import { useMutation } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { sendChannelMessage } from "@/src/features/chat/api/send-channel-message";
import { chatMessageWindowStore } from "@/src/features/chat/store/chat-message-window-store";
import type {
  ChannelMessage,
  ClientProfileSummary,
  ClientSticker,
} from "@/src/features/chat/types";

type SendChannelMessageVariables = {
  boardId: string;
  channelId: string;
  content: string;
  tempId: string;
  attachmentAssetId?: string;
  sticker?: ClientSticker;
  replyToMessageId?: string;
};

function createTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export { createTempId };

function toProfileSummary(profile: ReturnType<typeof useProfile>): ClientProfileSummary {
  return {
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
      ? { id: profile.badgeSticker.id, asset: profile.badgeSticker.asset }
      : null,
  };
}

function createOptimisticMessage({
  tempId,
  content,
  profile,
  channelId,
  attachmentAssetId,
  sticker,
}: {
  tempId: string;
  content: string;
  profile: ReturnType<typeof useProfile>;
  channelId: string;
  attachmentAssetId?: string;
  sticker?: ClientSticker | null;
}): ChannelMessage {
  const now = new Date().toISOString();
  return {
    id: tempId,
    tempId,
    isOptimistic: true,
    content,
    type: "TEXT",
    attachmentAssetId: attachmentAssetId ?? null,
    attachmentAsset: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    messageSenderId: profile.id,
    messageSender: toProfileSummary(profile),
    member: null,
    sticker: sticker ?? null,
    reactions: [],
    replyTo: null,
    filePreviewUrl: null,
    fileStaticPreviewUrl: null,
    channelId,
  };
}

export function useSendChannelMessage(windowKey: string) {
  const profile = useProfile();

  return useMutation<ChannelMessage, Error, SendChannelMessageVariables>({
    mutationFn: ({ boardId, channelId, content, tempId, attachmentAssetId, sticker, replyToMessageId }) =>
      sendChannelMessage({
        boardId,
        channelId,
        profileId: profile.id,
        content: content.trim(),
        tempId,
        attachmentAssetId,
        stickerId: sticker?.id,
        replyToMessageId,
      }),

    onMutate: ({ channelId, content, tempId, attachmentAssetId, sticker }) => {
      const optimistic = createOptimisticMessage({
        tempId,
        content: content.trim(),
        profile,
        channelId,
        attachmentAssetId,
        sticker,
      });
      chatMessageWindowStore.upsertIncomingMessage(windowKey, optimistic);
    },

    onError: (_error, variables) => {
      chatMessageWindowStore.removeById(windowKey, variables.tempId);
    },

    onSuccess: (serverMessage, variables) => {
      chatMessageWindowStore.replaceOptimisticByTempId(
        windowKey,
        variables.tempId,
        serverMessage,
      );
    },
  });
}
