"use client";

import { useEffect } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { acquireBoardRoom, releaseBoardRoom, rejoinBoardRooms } from "@/hooks/board-room-subscriptions";
import {
  useVoiceParticipantsStore,
  type VoiceParticipant,
} from "./use-voice-participants-store";

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

export function useVoiceParticipantsSocket(boardId: string) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !boardId) return;


    // Pull store actions once to avoid re-subscriptions.
    const { addParticipant, removeParticipant, setParticipants } =
      useVoiceParticipantsStore.getState();

    const handleVoiceJoin = (data: VoiceJoinEvent) => {
      addParticipant(data.channelId, {
        profileId: data.participant.profileId,
        username: data.participant.username,
        avatarUrl: data.participant.avatarUrl,
        usernameColor: data.participant.usernameColor,
      });
    };

    const handleVoiceLeave = (data: VoiceLeaveEvent) => {
      removeParticipant(data.channelId, data.profileId);
    };

    const handleVoiceParticipants = (data: VoiceParticipantsEvent) => {
      setParticipants(
        data.channelId,
        data.participants.map((p) => ({
          profileId: p.profileId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          usernameColor: p.usernameColor,
        })),
      );
    };

    const joinEvent = `voice:${boardId}:join`;
    const leaveEvent = `voice:${boardId}:leave`;
    const participantsEvent = `voice:${boardId}:participants`;

    socket.on(joinEvent, handleVoiceJoin);
    socket.on(leaveEvent, handleVoiceLeave);
    socket.on(participantsEvent, handleVoiceParticipants);

    const syncBoardParticipants = () => {
      // Keep board room membership after reconnects, then refresh participants.
      rejoinBoardRooms(socket);
      socket.emit("voice-get-board-participants", { boardId });
    };

    acquireBoardRoom(socket, boardId);

    // If already connected, sync immediately; also re-sync on reconnect (Socket.IO fires "connect").
    if (socket.connected) {
      syncBoardParticipants();
    } else {
    }
    socket.on("connect", syncBoardParticipants);

    return () => {
      socket.off(joinEvent, handleVoiceJoin);
      socket.off(leaveEvent, handleVoiceLeave);
      socket.off(participantsEvent, handleVoiceParticipants);
      socket.off("connect", syncBoardParticipants);
      releaseBoardRoom(socket, boardId);
    };
  }, [socket, boardId]);
}
