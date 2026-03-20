"use client";

import { useEffect, useRef } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { MESSAGES_PER_PAGE } from "./chat/types";
import { useUnreadStore } from "./use-unread-store";
import type { ChatMessage, MessageWithMember } from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { clearOptimisticTimeout } from "./use-chat-socket";
import {
  getTrackedChatRoomIds,
  useChatRoomLifecycleStore,
} from "./use-chat-room-lifecycle-store";

const MAX_ITEMS_PER_PAGE = MESSAGES_PER_PAGE;

type ChannelMessagePayload = MessageWithMember & {
  tempId?: string;
  isOptimistic?: boolean;
  channelId?: string;
};

interface PaginatedMessagePage {
  items: MessageWithMember[];
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
                  items: [cleanMessage as MessageWithMember],
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
                  item: MessageWithMember & {
                    isOptimistic?: boolean;
                    tempId?: string;
                  },
                ) => item.isOptimistic && item.tempId === message.tempId,
              );

              if (optimisticIndex !== -1) {
                const updatedItems = [...page.items];
                updatedItems[optimisticIndex] = cleanMessage as MessageWithMember;
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
            cleanMessage as MessageWithMember,
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
      const messageSender = message.member?.profile || null;
      const isOwnMessage = messageSender?.id === currentProfileId;
      const isViewingThisRoom = unreadState.viewingRoom === channelId;

      if (!isOwnMessage && !isViewingThisRoom) {
        unreadState.addUnread(channelId);
      }
    };

    const handleChannelUpdate = (
      channelId: string,
      message: MessageWithMember,
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

    const setupListenersForChannel = (channelId: string) => {
      const addKey = `chat:${channelId}:messages`;
      const updateKey = `chat:${channelId}:messages:update`;

      const onMessage = (message: ChannelMessagePayload) => {
        handleChannelMessage(channelId, message);
      };

      const onUpdate = (message: MessageWithMember) => {
        handleChannelUpdate(channelId, message);
      };

      socket.on(addKey, onMessage);
      socket.on(updateKey, onUpdate);

      return () => {
        socket.off(addKey, onMessage);
        socket.off(updateKey, onUpdate);
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
