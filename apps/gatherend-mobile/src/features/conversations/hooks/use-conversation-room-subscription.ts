import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSocket } from "@/src/providers/socket-context";

type UseConversationRoomSubscriptionOptions = {
  conversationId?: string;
  enabled?: boolean;
};

export function useConversationRoomSubscription({
  conversationId,
  enabled = true,
}: UseConversationRoomSubscriptionOptions) {
  const { socket, recoveryVersion } = useSocket();

  useEffect(() => {
    if (!socket || !enabled || !conversationId) {
      return;
    }

    const joinConversation = () => {
      if (!socket.connected) return;
      socket.emit("join-conversation", { conversationId });
    };

    const leaveConversation = () => {
      if (!socket.connected) return;
      socket.emit("leave-conversation", { conversationId });
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        joinConversation();
      }
    };

    joinConversation();
    socket.on("connect", joinConversation);
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      appStateSubscription.remove();
      socket.off("connect", joinConversation);
      leaveConversation();
    };
  }, [conversationId, enabled, recoveryVersion, socket]);
}
