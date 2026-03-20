"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useUnreadStore } from "./use-unread-store";
import type {
  ChatMessage,
  ChatReaction,
  DirectMessageWithSender,
} from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { clearOptimisticTimeout } from "./use-chat-socket";
import { MESSAGES_PER_PAGE } from "./chat/types";
import {
  getTrackedChatRoomIds,
  useChatRoomLifecycleStore,
} from "./use-chat-room-lifecycle-store";

const MAX_ITEMS_PER_PAGE = MESSAGES_PER_PAGE;

type ConversationMessagePayload = DirectMessageWithSender & {
  tempId?: string;
  isOptimistic?: boolean;
};

interface ReactionPayload {
  messageId: string;
  reaction: ChatReaction;
  action: "add" | "remove";
}

interface PaginatedMessagePage {
  items: DirectMessageWithSender[];
  nextCursor?: string | null;
  previousCursor?: string | null;
}

interface PaginatedMessageData {
  pages: PaginatedMessagePage[];
  pageParams?: unknown[];
}

interface UseGlobalConversationListenersProps {
  currentProfileId: string;
}

export function useGlobalConversationListeners({
  currentProfileId,
}: UseGlobalConversationListenersProps) {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const addUnread = useUnreadStore((state) => state.addUnread);

  const trackedConversationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    trackedConversationsRef.current = new Set(
      getTrackedChatRoomIds(
        useChatRoomLifecycleStore.getState().rooms,
        "conversation",
      ),
    );

    const unsubscribe = useChatRoomLifecycleStore.subscribe((state) => {
      trackedConversationsRef.current = new Set(
        getTrackedChatRoomIds(state.rooms, "conversation"),
      );
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConversationMessage = (
      conversationId: string,
      message: ConversationMessagePayload,
    ) => {
      if (!trackedConversationsRef.current.has(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      if (message.tempId) {
        clearOptimisticTimeout(message.tempId);
      }

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          const pages = Array.isArray(oldData?.pages) ? [...oldData.pages] : [];
          const firstPage = pages[0];
          const { tempId: _, isOptimistic: __, ...cleanMessage } = message;

          if (!firstPage || !Array.isArray(firstPage.items)) {
            return {
              pages: [
                {
                  items: [cleanMessage as DirectMessageWithSender],
                  nextCursor: null,
                  previousCursor: null,
                },
              ],
              pageParams: [undefined],
            };
          }

          if (message.tempId) {
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
              const page = pages[pageIndex];
              if (!page || !Array.isArray(page.items)) continue;

              const optimisticIndex = page.items.findIndex(
                (
                  item: DirectMessageWithSender & {
                    isOptimistic?: boolean;
                    tempId?: string;
                  },
                ) => item.isOptimistic && item.tempId === message.tempId,
              );

              if (optimisticIndex !== -1) {
                const updatedItems = [...page.items];
                updatedItems[optimisticIndex] =
                  cleanMessage as DirectMessageWithSender;
                pages[pageIndex] = { ...page, items: updatedItems };
                return { ...oldData, pages };
              }
            }
          }

          const alreadyExists = pages.some(
            (page) =>
              page &&
              Array.isArray(page.items) &&
              page.items.some((item) => item.id === message.id),
          );
          if (alreadyExists) {
            return oldData;
          }

          const newItems = [
            cleanMessage as DirectMessageWithSender,
            ...firstPage.items,
          ];

          if (newItems.length > MAX_ITEMS_PER_PAGE) {
            const truncated = newItems.slice(0, MAX_ITEMS_PER_PAGE);
            const lastKept = truncated[truncated.length - 1];
            pages[0] = {
              ...firstPage,
              items: truncated,
              nextCursor: lastKept?.id || firstPage.nextCursor,
            };
            return { ...oldData, pages };
          }

          pages[0] = { ...firstPage, items: newItems };
          return { ...oldData, pages };
        },
      );

      const { tempId: _, isOptimistic: __, ...cleanMessage } = message;
      const live = chatMessageWindowStore.get(windowKey);
      const preferAfterCache = Boolean(live.hasMoreAfter);

      if (message.tempId) {
        chatMessageWindowStore.replaceOptimisticByTempId(
          windowKey,
          message.tempId,
          cleanMessage as unknown as ChatMessage,
        );
      }

      chatMessageWindowStore.upsertById(
        windowKey,
        cleanMessage as unknown as ChatMessage,
        {
          insertIfMissing: true,
          ...(preferAfterCache ? { preferAfterCache: true } : {}),
        },
      );

      const unreadState = useUnreadStore.getState();
      const sender = message.sender || null;
      const isOwnMessage = sender?.id === currentProfileId;
      const isViewingThisRoom = unreadState.viewingRoom === conversationId;

      if (!isOwnMessage && !isViewingThisRoom) {
        addUnread(conversationId, Date.now());
      }
    };

    const handleConversationUpdate = (
      conversationId: string,
      message: DirectMessageWithSender,
    ) => {
      if (!trackedConversationsRef.current.has(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          if (message.deleted) {
            const newPages = oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== message.id),
            }));
            return { ...oldData, pages: newPages };
          }

          const newPages = oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === message.id ? message : item,
            ),
          }));
          return { ...oldData, pages: newPages };
        },
      );

      if (message.deleted) {
        chatMessageWindowStore.removeById(windowKey, message.id);
        return;
      }

      chatMessageWindowStore.upsertById(
        windowKey,
        message as unknown as ChatMessage,
        { insertIfMissing: false },
      );
    };

    const handleConversationReaction = (
      conversationId: string,
      data: ReactionPayload,
    ) => {
      if (!trackedConversationsRef.current.has(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          const pages = oldData.pages.map((page) => {
            if (!page || !Array.isArray(page.items)) return page;
            return {
              ...page,
              items: page.items.map((message) => {
                if (message.id !== data.messageId) return message;
                const currentReactions = message.reactions || [];

                if (data.action === "add") {
                  if (
                    currentReactions.some(
                      (reaction) => reaction.id === data.reaction.id,
                    )
                  ) {
                    return message;
                  }
                  return {
                    ...message,
                    reactions: [...currentReactions, data.reaction],
                  };
                }

                return {
                  ...message,
                  reactions: currentReactions.filter(
                    (reaction) => reaction.id !== data.reaction.id,
                  ),
                };
              }),
            };
          });

          return { ...oldData, pages };
        },
      );

      chatMessageWindowStore.updateById(windowKey, data.messageId, (prev) => {
        const current = (prev as DirectMessageWithSender).reactions;
        const currentReactions = Array.isArray(current) ? current : [];

        if (data.action === "add") {
          if (
            currentReactions.some(
              (reaction) => reaction.id === data.reaction.id,
            )
          ) {
            return prev;
          }
          return {
            ...(prev as DirectMessageWithSender),
            reactions: [...currentReactions, data.reaction],
          };
        }

        return {
          ...(prev as DirectMessageWithSender),
          reactions: currentReactions.filter(
            (reaction) => reaction.id !== data.reaction.id,
          ),
        };
      });
    };

    const setupListenersForConversation = (conversationId: string) => {
      const addKey = `chat:${conversationId}:messages`;
      const updateKey = `chat:${conversationId}:messages:update`;
      const reactionKey = `chat:${conversationId}:reactions`;

      const onMessage = (message: ConversationMessagePayload) => {
        handleConversationMessage(conversationId, message);
      };
      const onUpdate = (message: DirectMessageWithSender) => {
        handleConversationUpdate(conversationId, message);
      };
      const onReaction = (data: ReactionPayload) => {
        handleConversationReaction(conversationId, data);
      };

      socket.on(addKey, onMessage);
      socket.on(updateKey, onUpdate);
      socket.on(reactionKey, onReaction);

      return () => {
        socket.off(addKey, onMessage);
        socket.off(updateKey, onUpdate);
        socket.off(reactionKey, onReaction);
      };
    };

    const conversationCleanups = new Map<string, () => void>();

    const syncConversationListeners = (
      currentConversations: Set<string>,
      prevConversations: Set<string>,
    ) => {
      currentConversations.forEach((conversationId) => {
        if (
          !prevConversations.has(conversationId) &&
          !conversationCleanups.has(conversationId)
        ) {
          const cleanup = setupListenersForConversation(conversationId);
          conversationCleanups.set(conversationId, cleanup);
        }
      });

      prevConversations.forEach((conversationId) => {
        if (!currentConversations.has(conversationId)) {
          const cleanup = conversationCleanups.get(conversationId);
          if (cleanup) {
            cleanup();
            conversationCleanups.delete(conversationId);
          }
        }
      });
    };

    const initialConversations = new Set(
      getTrackedChatRoomIds(
        useChatRoomLifecycleStore.getState().rooms,
        "conversation",
      ),
    );
    trackedConversationsRef.current = initialConversations;
    syncConversationListeners(initialConversations, new Set());

    const unsubscribeStore = useChatRoomLifecycleStore.subscribe(
      (state, prevState) => {
        const current = new Set(
          getTrackedChatRoomIds(state.rooms, "conversation"),
        );
        const prev = new Set(
          getTrackedChatRoomIds(prevState.rooms, "conversation"),
        );

        trackedConversationsRef.current = current;
        syncConversationListeners(current, prev);
      },
    );

    return () => {
      unsubscribeStore();
      conversationCleanups.forEach((cleanup) => cleanup());
      conversationCleanups.clear();
    };
  }, [socket, queryClient, addUnread, currentProfileId]);
}
