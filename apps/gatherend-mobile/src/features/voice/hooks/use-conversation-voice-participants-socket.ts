import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  useVoiceParticipantsStore,
  type VoiceParticipant,
} from "@/src/features/voice/store/use-voice-participants-store";
import { useSocket } from "@/src/providers/socket-context";

interface VoiceJoinEvent {
  channelId: string;
  participant: VoiceParticipant;
}

interface VoiceLeaveEvent {
  channelId: string;
  profileId: string;
}

interface VoiceParticipantsEvent {
  channelId: string;
  participants: VoiceParticipant[];
}

export function useConversationVoiceParticipantsSocket(
  conversationId?: string,
  enabled = true,
) {
  const { socket, recoveryVersion } = useSocket();

  useEffect(() => {
    if (!socket || !enabled || !conversationId) return;

    const { addParticipant, removeParticipant, setParticipants, clearChannel } =
      useVoiceParticipantsStore.getState();

    const handleVoiceJoin = (data: VoiceJoinEvent) => {
      addParticipant(data.channelId, data.participant);
    };

    const handleVoiceLeave = (data: VoiceLeaveEvent) => {
      removeParticipant(data.channelId, data.profileId);
    };

    const handleParticipants = (data: VoiceParticipantsEvent) => {
      setParticipants(data.channelId, data.participants);
    };

    const syncParticipants = () => {
      if (!socket.connected) return;
      socket.emit("voice-get-participants", {
        channelId: conversationId,
        context: "conversation",
      });
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        syncParticipants();
      }
    };

    const joinEvent = `voice:conversation:${conversationId}:join`;
    const leaveEvent = `voice:conversation:${conversationId}:leave`;
    const participantsEvent = `voice:conversation:${conversationId}:participants`;

    socket.on(joinEvent, handleVoiceJoin);
    socket.on(leaveEvent, handleVoiceLeave);
    socket.on(participantsEvent, handleParticipants);
    socket.on("connect", syncParticipants);

    syncParticipants();
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      appStateSubscription.remove();
      socket.off(joinEvent, handleVoiceJoin);
      socket.off(leaveEvent, handleVoiceLeave);
      socket.off(participantsEvent, handleParticipants);
      socket.off("connect", syncParticipants);
      clearChannel(conversationId);
    };
  }, [conversationId, enabled, recoveryVersion, socket]);
}
