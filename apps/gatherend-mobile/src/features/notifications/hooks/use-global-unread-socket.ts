import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/src/providers/socket-context";
import { useUnreadStore } from "../stores/use-unread-store";
import { CONVERSATIONS_QUERY_KEY } from "@/src/features/conversations/queries";
import type { Conversation } from "@/src/features/conversations/domain/conversation";

interface UseGlobalUnreadSocketProps {
  currentProfileId: string;
}

interface ChannelActivityPayload {
  channelId: string;
  boardId: string;
  messageSeq: number;
  senderProfileId: string;
}

interface DirectMessagePayload {
  conversationId: string;
  messageTimestamp?: number;
  sender?: { id: string; username: string };
  lastMessage?: {
    content: string;
    hasAttachment?: boolean;
    stickerName?: string | null;
    deleted: boolean;
    senderId: string;
  };
}

export function useGlobalUnreadSocket({
  currentProfileId,
}: UseGlobalUnreadSocketProps) {
  const { socket } = useSocketClient();
  const { addUnread, addDmUnread } = useUnreadStore();
  const viewingRoom = useUnreadStore((s) => s.viewingRoom);
  const lastAck = useUnreadStore((s) => s.lastAck);
  const queryClient = useQueryClient();

  const invalidateTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const viewingRoomRef = useRef(viewingRoom);
  const lastAckRef = useRef(lastAck);

  useEffect(() => {
    viewingRoomRef.current = viewingRoom;
  }, [viewingRoom]);

  useEffect(() => {
    lastAckRef.current = lastAck;
  }, [lastAck]);

  // Stable dep: currentProfileId won't change mid-session
  const profileId = useMemo(() => currentProfileId, [currentProfileId]);

  useEffect(() => {
    if (!socket) return;

    const timers = invalidateTimersRef.current;

    const scheduleChatInvalidate = (
      roomType: "channel" | "conversation",
      roomId: string,
    ) => {
      const key = `${roomType}:${roomId}`;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        timers.delete(key);
        queryClient.invalidateQueries({
          queryKey: ["chat", roomType, roomId],
          refetchType: "none",
        });
      }, 250);

      timers.set(key, timeout);
    };

    const handleChannelMessage = (payload: ChannelActivityPayload) => {
      const { channelId, messageSeq, senderProfileId } = payload;
      const isOwnMessage = senderProfileId === profileId;
      const isViewingThisRoom = viewingRoomRef.current === channelId;
      const currentLastAck = lastAckRef.current[channelId] || 0;
      const isAfterLastAck = messageSeq > currentLastAck;

      if (!isOwnMessage && !isViewingThisRoom && isAfterLastAck) {
        addUnread(channelId, messageSeq);
        scheduleChatInvalidate("channel", channelId);
      }

      // Fallback: refresh active query if user is viewing this channel
      if (!isOwnMessage && isViewingThisRoom) {
        void queryClient.invalidateQueries({
          queryKey: ["chat", "channel", channelId],
          refetchType: "active",
        });
      }
    };

    const handleDirectMessage = (payload: DirectMessagePayload) => {
      const { conversationId, sender, lastMessage, messageTimestamp } = payload;
      const isOwnMessage = sender?.id === profileId;
      const isViewingThisRoom = viewingRoomRef.current === conversationId;
      const currentLastAck = lastAckRef.current[conversationId] || 0;
      const msgTime = messageTimestamp || Date.now();
      const isAfterLastAck = msgTime > currentLastAck;

      if (!isOwnMessage && !isViewingThisRoom && isAfterLastAck) {
        addDmUnread(conversationId, msgTime);
        scheduleChatInvalidate("conversation", conversationId);
      }

      // Update conversations list cache (move to top with new last message)
      if (lastMessage) {
        queryClient.setQueryData<Conversation[]>(
          CONVERSATIONS_QUERY_KEY,
          (oldConversations) => {
            if (!oldConversations) return oldConversations;

            const existingIdx = oldConversations.findIndex(
              (c) => c.id === conversationId,
            );

            if (existingIdx >= 0) {
              const updated: Conversation = {
                ...oldConversations[existingIdx],
                lastMessage: {
                  content: lastMessage.content,
                  hasAttachment: lastMessage.hasAttachment ?? false,
                  stickerName: lastMessage.stickerName ?? null,
                  deleted: lastMessage.deleted,
                  senderId: lastMessage.senderId,
                },
                updatedAt: new Date().toISOString(),
              };
              const filtered = oldConversations.filter(
                (c) => c.id !== conversationId,
              );
              return [updated, ...filtered];
            } else {
              // New conversation — invalidate to fetch fresh data
              queryClient.invalidateQueries({
                queryKey: CONVERSATIONS_QUERY_KEY,
              });
              return oldConversations;
            }
          },
        );
      }
    };

    socket.on("global:channel:activity", handleChannelMessage);
    socket.on("global:conversation:message", handleDirectMessage);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      socket.off("global:channel:activity", handleChannelMessage);
      socket.off("global:conversation:message", handleDirectMessage);
    };
  }, [socket, profileId, addUnread, addDmUnread, queryClient]);
}
