import { useEffect } from "react";
import type { ChannelMessage } from "@/src/features/chat/types";
import { chatMessageWindowStore } from "@/src/features/chat/store/chat-message-window-store";
import { useSocket } from "@/src/providers/socket-context";

type IncomingChannelMessage = ChannelMessage & {
  tempId?: string;
  isOptimistic?: boolean;
};

type UseChannelSocketOptions = {
  windowKey: string;
  channelId?: string;
  enabled?: boolean;
};

export function useChannelSocket({
  windowKey,
  channelId,
  enabled = true,
}: UseChannelSocketOptions) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !enabled || !channelId) return;

    const messageEvent = `chat:${channelId}:messages`;
    const messageUpdateEvent = `chat:${channelId}:messages:update`;

    const handleChannelMessage = (incoming: IncomingChannelMessage) => {
      const { tempId, isOptimistic, ...rest } = incoming;
      void isOptimistic;
      const message = rest as ChannelMessage;

      if (tempId) {
        chatMessageWindowStore.replaceOptimisticByTempId(windowKey, tempId, message);
      }
      // Always attempt upsert — no-op if the message is already in the store.
      chatMessageWindowStore.upsertIncomingMessage(windowKey, message);
    };

    const handleChannelMessageUpdate = (message: Partial<ChannelMessage> & { id: string }) => {
      if (message.deleted) {
        chatMessageWindowStore.removeById(windowKey, message.id);
        return;
      }

      chatMessageWindowStore.upsertById(windowKey, message, {
        insertIfMissing: false,
      });
    };

    socket.on(messageEvent, handleChannelMessage);
    socket.on(messageUpdateEvent, handleChannelMessageUpdate);

    return () => {
      socket.off(messageEvent, handleChannelMessage);
      socket.off(messageUpdateEvent, handleChannelMessageUpdate);
    };
  }, [channelId, enabled, socket, windowKey]);
}
