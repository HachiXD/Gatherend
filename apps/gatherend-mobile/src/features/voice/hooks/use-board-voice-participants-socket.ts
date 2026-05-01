import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  acquireBoardRoom,
  rejoinBoardRooms,
  releaseBoardRoom,
} from "@/src/features/voice/lib/board-room-subscriptions";
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

export function useBoardVoiceParticipantsSocket(boardId?: string) {
  const { socket, recoveryVersion } = useSocket();

  useEffect(() => {
    if (!socket || !boardId) return;

    const { addParticipant, removeParticipant, setParticipants } =
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

    const syncBoardParticipants = () => {
      if (!socket.connected) return;
      rejoinBoardRooms(socket);
      socket.emit("voice-get-board-participants", { boardId });
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        syncBoardParticipants();
      }
    };

    const joinEvent = `voice:${boardId}:join`;
    const leaveEvent = `voice:${boardId}:leave`;
    const participantsEvent = `voice:${boardId}:participants`;

    socket.on(joinEvent, handleVoiceJoin);
    socket.on(leaveEvent, handleVoiceLeave);
    socket.on(participantsEvent, handleParticipants);
    socket.on("connect", syncBoardParticipants);

    acquireBoardRoom(socket, boardId);
    syncBoardParticipants();
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      appStateSubscription.remove();
      socket.off(joinEvent, handleVoiceJoin);
      socket.off(leaveEvent, handleVoiceLeave);
      socket.off(participantsEvent, handleParticipants);
      socket.off("connect", syncBoardParticipants);
      releaseBoardRoom(socket, boardId);
    };
  }, [boardId, recoveryVersion, socket]);
}
