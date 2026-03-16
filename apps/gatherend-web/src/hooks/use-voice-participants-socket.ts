"use client";

import { useEffect } from "react";
import { useSocket } from "@/components/providers/socket-provider";
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
      // Idempotent on the server. Calling on each connect keeps rooms + state consistent.
      socket.emit("join-board", { boardId });
      socket.emit("voice-get-board-participants", { boardId });
    };

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
    };
  }, [socket, boardId]);
}
