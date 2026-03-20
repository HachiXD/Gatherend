"use client";

import { useEffect, useRef } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import type { TrackedChatRoom } from "./use-chat-room-lifecycle-store";
import {
  getTrackedChatRooms,
  useChatRoomLifecycleStore,
} from "./use-chat-room-lifecycle-store";

function emitJoin(
  socket: NonNullable<ReturnType<typeof useSocketClient>["socket"]>,
  room: TrackedChatRoom,
) {
  if (room.roomType === "channel") {
    socket.emit("join-channel", { channelId: room.roomId });
    return;
  }

  socket.emit("join-conversation", { conversationId: room.roomId });
}

function emitLeave(
  socket: NonNullable<ReturnType<typeof useSocketClient>["socket"]>,
  room: TrackedChatRoom,
) {
  if (room.roomType === "channel") {
    socket.emit("leave-channel", { channelId: room.roomId });
    return;
  }

  socket.emit("leave-conversation", { conversationId: room.roomId });
}

function getWindowKey(room: TrackedChatRoom) {
  return `chatWindow:${room.roomType}:${room.roomId}`;
}

export function useChatRoomSubscriptionSync() {
  const { socket } = useSocketClient();
  const trackedRoomsRef = useRef<TrackedChatRoom[]>([]);

  useEffect(() => {
    trackedRoomsRef.current = getTrackedChatRooms(
      useChatRoomLifecycleStore.getState().rooms,
    );
  }, []);

  useEffect(() => {
    if (!socket) return;

    trackedRoomsRef.current = getTrackedChatRooms(
      useChatRoomLifecycleStore.getState().rooms,
    );

    const syncMembershipDiff = (
      nextRooms: Record<string, TrackedChatRoom>,
      prevRooms: Record<string, TrackedChatRoom>,
    ) => {
      Object.keys(nextRooms).forEach((key) => {
        if (prevRooms[key]) return;
        if (!socket.connected) return;
        emitJoin(socket, nextRooms[key]);
      });

      Object.keys(prevRooms).forEach((key) => {
        if (nextRooms[key]) return;
        if (socket.connected) {
          emitLeave(socket, prevRooms[key]);
        }
        chatMessageWindowStore.deleteIfUnused(getWindowKey(prevRooms[key]));
      });
    };

    const unsubscribeStore = useChatRoomLifecycleStore.subscribe(
      (state, prevState) => {
        trackedRoomsRef.current = getTrackedChatRooms(state.rooms);
        syncMembershipDiff(
          state.rooms as Record<string, TrackedChatRoom>,
          prevState.rooms as Record<string, TrackedChatRoom>,
        );
      },
    );

    const joinTrackedRooms = () => {
      trackedRoomsRef.current.forEach((room) => {
        emitJoin(socket, room);
      });
    };

    const markTrackedRoomsNeedsCatchUp = () => {
      trackedRoomsRef.current.forEach((room) => {
        chatMessageWindowStore.markNeedsCatchUpIfExists(getWindowKey(room));
      });
    };

    if (socket.connected) {
      joinTrackedRooms();
    }

    const handleConnect = () => {
      joinTrackedRooms();
    };

    const handleDisconnect = () => {
      markTrackedRoomsNeedsCatchUp();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) return;
      joinTrackedRooms();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      unsubscribeStore();
    };
  }, [socket]);
}
