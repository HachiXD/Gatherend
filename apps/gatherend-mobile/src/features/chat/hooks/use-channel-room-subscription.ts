import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSocket } from "@/src/providers/socket-context";

type UseChannelRoomSubscriptionOptions = {
  channelId?: string;
  enabled?: boolean;
};

export function useChannelRoomSubscription({
  channelId,
  enabled = true,
}: UseChannelRoomSubscriptionOptions) {
  const { socket, recoveryVersion } = useSocket();

  useEffect(() => {
    if (!socket || !enabled || !channelId) {
      return;
    }

    const joinChannel = () => {
      if (!socket.connected) return;
      socket.emit("join-channel", { channelId });
    };

    const leaveChannel = () => {
      if (!socket.connected) return;
      socket.emit("leave-channel", { channelId });
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        joinChannel();
      }
    };

    joinChannel();
    socket.on("connect", joinChannel);
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      appStateSubscription.remove();
      socket.off("connect", joinChannel);
      leaveChannel();
    };
  }, [channelId, enabled, recoveryVersion, socket]);
}
