import { useEffect } from "react";
import { chatMessageWindowStore } from "@/src/features/chat/store/chat-message-window-store";
import type { DirectMessage } from "@/src/features/conversations/domain/direct-message";
import { useSocket } from "@/src/providers/socket-context";

type IncomingDirectMessage = DirectMessage & {
  tempId?: string;
  isOptimistic?: boolean;
};

type UseConversationSocketOptions = {
  windowKey: string;
  conversationId?: string;
  enabled?: boolean;
};

export function useConversationSocket({
  windowKey,
  conversationId,
  enabled = true,
}: UseConversationSocketOptions) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !enabled || !conversationId) return;

    const messageEvent = `chat:${conversationId}:messages`;
    const messageUpdateEvent = `chat:${conversationId}:messages:update`;

    const handleDirectMessage = (incoming: IncomingDirectMessage) => {
      const { tempId, isOptimistic, ...rest } = incoming;
      void isOptimistic;
      const message = rest as DirectMessage;

      if (tempId) {
        chatMessageWindowStore.replaceOptimisticByTempId(
          windowKey,
          tempId,
          message,
        );
      }

      chatMessageWindowStore.upsertIncomingMessage(windowKey, message);
    };

    const handleDirectMessageUpdate = (message: DirectMessage) => {
      chatMessageWindowStore.upsertById(windowKey, message, {
        insertIfMissing: false,
      });
    };

    socket.on(messageEvent, handleDirectMessage);
    socket.on(messageUpdateEvent, handleDirectMessageUpdate);

    return () => {
      socket.off(messageEvent, handleDirectMessage);
      socket.off(messageUpdateEvent, handleDirectMessageUpdate);
    };
  }, [conversationId, enabled, socket, windowKey]);
}
