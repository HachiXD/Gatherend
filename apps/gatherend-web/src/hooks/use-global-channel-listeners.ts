"use client";

import { useEffect, useRef } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { MESSAGES_PER_PAGE } from "./chat/types";
import { useUnreadStore } from "./use-unread-store";
import type {
  ChannelMessage,
  ChatMessage,
  ChatReaction,
} from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { clearOptimisticTimeout } from "./use-chat-socket";
import {
  getTrackedChatRoomIds,
  useChatRoomLifecycleStore,
} from "./use-chat-room-lifecycle-store";
import { getMessageOwnerProfileId } from "@/hooks/chat";

const MAX_ITEMS_PER_PAGE = MESSAGES_PER_PAGE;

type ChannelMessagePayload = ChannelMessage & {
  tempId?: string;
  isOptimistic?: boolean;
  channelId?: string;
};

interface ReactionPayload {
  messageId: string;
  reaction: ChatReaction;
  action: "add" | "remove";
}

interface PaginatedMessagePage {
  items: ChannelMessage[];
  nextCursor?: string | null;
  previousCursor?: string | null;
}

interface PaginatedMessageData {
  pages: PaginatedMessagePage[];
  pageParams?: unknown[];
}

interface UseGlobalChannelListenersProps {
  currentProfileId: string;
}

export function useGlobalChannelListeners({
  currentProfileId,
}: UseGlobalChannelListenersProps) {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  const trackedChannelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    trackedChannelsRef.current = new Set(
      getTrackedChatRoomIds(useChatRoomLifecycleStore.getState().rooms, "channel"),
    );

    const unsubscribe = useChatRoomLifecycleStore.subscribe((state) => {
      trackedChannelsRef.current = new Set(
        getTrackedChatRoomIds(state.rooms, "channel"),
      );
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleChannelMessage = (
      channelId: string,
      message: ChannelMessagePayload,
    ) => {
      if (!trackedChannelsRef.current.has(channelId)) {
        return;
      }

      const key = ["chat", "channel", channelId];
      const windowKey = `chatWindow:channel:${channelId}`;

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
                  items: [cleanMessage as ChannelMessage],
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
                  item: ChannelMessage & {
                    isOptimistic?: boolean;
                    tempId?: string;
                  },
                ) => item.isOptimistic && item.tempId === message.tempId,
              );

              if (optimisticIndex !== -1) {
                const updatedItems = [...page.items];
                updatedItems[optimisticIndex] = cleanMessage as ChannelMessage;
                pages[pageIndex] = { ...page, items: updatedItems };
                return { ...oldData, pages };
              }
            }
          }

          const messageAlreadyExists = pages.some(
            (page) =>
              page &&
              Array.isArray(page.items) &&
              page.items.some((item) => item.id === message.id),
          );
          if (messageAlreadyExists) {
            return oldData;
          }

          const newItems = [
            cleanMessage as ChannelMessage,
            ...firstPage.items,
          ];

          if (newItems.length > MAX_ITEMS_PER_PAGE) {
            const truncatedItems = newItems.slice(0, MAX_ITEMS_PER_PAGE);
            const lastKeptItem = truncatedItems[truncatedItems.length - 1];
            pages[0] = {
              ...firstPage,
              items: truncatedItems,
              nextCursor: lastKeptItem?.id || firstPage.nextCursor,
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
      const isOwnMessage =
        getMessageOwnerProfileId(message as ChannelMessage) === currentProfileId;
      const isViewingThisRoom = unreadState.viewingRoom === channelId;

      if (!isOwnMessage && !isViewingThisRoom) {
        unreadState.addUnread(channelId);
      }
    };

    const handleChannelUpdate = (
      channelId: string,
      message: ChannelMessage,
    ) => {
      if (!trackedChannelsRef.current.has(channelId)) {
        return;
      }

      const key = ["chat", "channel", channelId];
      const windowKey = `chatWindow:channel:${channelId}`;

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

    const handleChannelReaction = (
      channelId: string,
      data: ReactionPayload,
    ) => {
      if (!trackedChannelsRef.current.has(channelId)) {
        return;
      }

      const key = ["chat", "channel", channelId];
      const windowKey = `chatWindow:channel:${channelId}`;

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
        const current = (prev as ChannelMessage).reactions;
        const currentReactions = Array.isArray(current) ? current : [];

        if (data.action === "add") {
          if (
            currentReactions.some((reaction) => reaction.id === data.reaction.id)
          ) {
            return prev;
          }
          return {
            ...(prev as ChannelMessage),
            reactions: [...currentReactions, data.reaction],
          };
        }

        return {
          ...(prev as ChannelMessage),
          reactions: currentReactions.filter(
            (reaction) => reaction.id !== data.reaction.id,
          ),
        };
      });
    };

    const setupListenersForChannel = (channelId: string) => {
      const addKey = `chat:${channelId}:messages`;
      const updateKey = `chat:${channelId}:messages:update`;
      const reactionKey = `chat:${channelId}:reactions`;

      const onMessage = (message: ChannelMessagePayload) => {
        handleChannelMessage(channelId, message);
      };

      const onUpdate = (message: ChannelMessage) => {
        handleChannelUpdate(channelId, message);
      };

      const onReaction = (data: ReactionPayload) => {
        handleChannelReaction(channelId, data);
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

    const channelCleanups = new Map<string, () => void>();

    const syncChannelListeners = (
      currentChannels: Set<string>,
      prevChannels: Set<string>,
    ) => {
      currentChannels.forEach((channelId) => {
        if (!prevChannels.has(channelId) && !channelCleanups.has(channelId)) {
          const cleanup = setupListenersForChannel(channelId);
          channelCleanups.set(channelId, cleanup);
        }
      });

      prevChannels.forEach((channelId) => {
        if (!currentChannels.has(channelId)) {
          const cleanup = channelCleanups.get(channelId);
          if (cleanup) {
            cleanup();
            channelCleanups.delete(channelId);
          }
        }
      });
    };

    const initialChannels = new Set(
      getTrackedChatRoomIds(useChatRoomLifecycleStore.getState().rooms, "channel"),
    );
    trackedChannelsRef.current = initialChannels;
    syncChannelListeners(initialChannels, new Set());

    const unsubscribeStore = useChatRoomLifecycleStore.subscribe(
      (state, prevState) => {
        const currentChannels = new Set(
          getTrackedChatRoomIds(state.rooms, "channel"),
        );
        const prevChannels = new Set(
          getTrackedChatRoomIds(prevState.rooms, "channel"),
        );

        trackedChannelsRef.current = currentChannels;
        syncChannelListeners(currentChannels, prevChannels);
      },
    );

    return () => {
      unsubscribeStore();
      channelCleanups.forEach((cleanup) => cleanup());
      channelCleanups.clear();
    };
  }, [socket, queryClient, currentProfileId]);
}
