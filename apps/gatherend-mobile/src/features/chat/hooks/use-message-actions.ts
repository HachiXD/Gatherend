import { useMutation } from "@tanstack/react-query";
import { addReaction } from "../api/add-reaction";
import { removeReaction } from "../api/remove-reaction";
import { editMessage } from "../api/edit-message";
import { deleteMessage } from "../api/delete-message";
import { pinMessage } from "../api/pin-message";
import { chatMessageWindowStore } from "../store/chat-message-window-store";
import type { ChatMessage } from "../chat-message";
import type { ChatReaction, ClientProfileSummary } from "../types";

type MessageActionsOptions = {
  windowKey: string;
  boardId: string;
  channelId: string;
  profileId: string;
};

const EMPTY_PROFILE: ClientProfileSummary = {
  id: "",
  username: "",
  discriminator: null,
  usernameColor: null,
  profileTags: [],
  badge: null,
  usernameFormat: null,
  avatarAsset: null,
  badgeSticker: null,
};

export function useMessageActions({
  windowKey,
  boardId,
  channelId,
  profileId,
}: MessageActionsOptions) {
  const addReactionMutation = useMutation({
    mutationFn: (vars: { messageId: string; emoji: string }) =>
      addReaction({
        messageId: vars.messageId,
        emoji: vars.emoji,
        boardId,
        channelId,
        profileId,
      }),
    onMutate: ({ messageId, emoji }) => {
      const tempReaction: ChatReaction = {
        id: `temp-${Date.now()}`,
        emoji,
        profileId,
        profile: { ...EMPTY_PROFILE, id: profileId },
      };
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            reactions: [...((m as { reactions?: ChatReaction[] }).reactions ?? []), tempReaction],
          }) as ChatMessage,
      );
      return { tempReaction };
    },
    onSuccess: (newReaction, { messageId }, context) => {
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            reactions: ((m as { reactions?: ChatReaction[] }).reactions ?? []).map((r) =>
              r.id === context?.tempReaction.id ? newReaction : r,
            ),
          }) as ChatMessage,
      );
    },
    onError: (_, { messageId }, context) => {
      if (!context?.tempReaction) return;
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            reactions: ((m as { reactions?: ChatReaction[] }).reactions ?? []).filter(
              (r) => r.id !== context.tempReaction.id,
            ),
          }) as ChatMessage,
      );
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: (vars: { reactionId: string; messageId: string }) =>
      removeReaction(vars.reactionId, profileId),
    onMutate: ({ reactionId, messageId }) => {
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            reactions: ((m as { reactions?: ChatReaction[] }).reactions ?? []).filter(
              (r) => r.id !== reactionId,
            ),
          }) as ChatMessage,
      );
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: (vars: { messageId: string; content: string }) =>
      editMessage({
        messageId: vars.messageId,
        content: vars.content,
        boardId,
        channelId,
        profileId,
      }),
    onMutate: ({ messageId, content }) => {
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            content,
            updatedAt: new Date().toISOString(),
          }) as ChatMessage,
      );
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (vars: { messageId: string }) =>
      deleteMessage({
        messageId: vars.messageId,
        boardId,
        channelId,
        profileId,
      }),
    onMutate: ({ messageId }) => {
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            deleted: true,
            content: "",
          }) as ChatMessage,
      );
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: (vars: { messageId: string; pin: boolean }) =>
      pinMessage({
        messageId: vars.messageId,
        boardId,
        channelId,
        profileId,
        pin: vars.pin,
      }),
    onMutate: ({ messageId, pin }) => {
      chatMessageWindowStore.updateById(
        windowKey,
        messageId,
        (m) =>
          ({
            ...m,
            pinned: pin,
          }) as ChatMessage,
      );
    },
  });

  return {
    addReaction: addReactionMutation,
    removeReaction: removeReactionMutation,
    editMessage: editMessageMutation,
    deleteMessage: deleteMessageMutation,
    pinMessage: pinMessageMutation,
  };
}
