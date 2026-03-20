"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type ChatRoomType = "channel" | "conversation";
export type ChatRoomStatus = "active" | "background";
export type ChatRoomKey = `${ChatRoomType}:${string}`;

export interface TrackedChatRoom {
  key: ChatRoomKey;
  roomType: ChatRoomType;
  roomId: string;
  mountCount: number;
  lastTouchedAt: number;
  status: ChatRoomStatus;
}

export const CHAT_BACKGROUND_ROOM_LIMITS: Record<ChatRoomType, number> = {
  channel: 15,
  conversation: 10,
};

export interface ChatRoomLifecycleState {
  rooms: Record<ChatRoomKey, TrackedChatRoom>;
  mountRoom: (roomType: ChatRoomType, roomId: string) => void;
  unmountRoom: (roomType: ChatRoomType, roomId: string) => void;
  touchRoom: (roomType: ChatRoomType, roomId: string) => void;
  evictOverflow: (roomType: ChatRoomType) => void;
  isTracked: (roomType: ChatRoomType, roomId: string) => boolean;
  isActive: (roomType: ChatRoomType, roomId: string) => boolean;
  getTrackedRooms: () => TrackedChatRoom[];
  getTrackedRoomIds: (roomType?: ChatRoomType) => string[];
  clear: () => void;
}

export function buildChatRoomKey(
  roomType: ChatRoomType,
  roomId: string,
): ChatRoomKey {
  return `${roomType}:${roomId}` as ChatRoomKey;
}

export function getTrackedChatRooms(
  rooms: Record<ChatRoomKey, TrackedChatRoom>,
): TrackedChatRoom[] {
  return Object.values(rooms);
}

export function getTrackedChatRoomsByType(
  rooms: Record<ChatRoomKey, TrackedChatRoom>,
  roomType: ChatRoomType,
): TrackedChatRoom[] {
  return getTrackedChatRooms(rooms).filter((room) => room.roomType === roomType);
}

export function getTrackedChatRoomIds(
  rooms: Record<ChatRoomKey, TrackedChatRoom>,
  roomType?: ChatRoomType,
): string[] {
  return getTrackedChatRooms(rooms)
    .filter((room) => (roomType ? room.roomType === roomType : true))
    .map((room) => room.roomId);
}

function evictOverflowRooms(
  rooms: Record<ChatRoomKey, TrackedChatRoom>,
  roomType: ChatRoomType,
): Record<ChatRoomKey, TrackedChatRoom> {
  const backgroundRooms = getTrackedChatRoomsByType(rooms, roomType)
    .filter((room) => room.status === "background")
    .sort((a, b) => b.lastTouchedAt - a.lastTouchedAt);

  const limit = CHAT_BACKGROUND_ROOM_LIMITS[roomType];
  if (backgroundRooms.length <= limit) return rooms;

  const nextRooms = { ...rooms };
  backgroundRooms.slice(limit).forEach((room) => {
    delete nextRooms[room.key];
  });

  return nextRooms;
}

export const useChatRoomLifecycleStore = create<ChatRoomLifecycleState>(
  (set, get) => ({
    rooms: {},

    mountRoom: (roomType, roomId) => {
      if (!roomId) return;

      set((state) => {
        const key = buildChatRoomKey(roomType, roomId);
        const now = Date.now();
        const existing = state.rooms[key];

        return {
          rooms: {
            ...state.rooms,
            [key]: {
              key,
              roomType,
              roomId,
              mountCount: (existing?.mountCount ?? 0) + 1,
              lastTouchedAt: now,
              status: "active",
            },
          },
        };
      });
    },

    unmountRoom: (roomType, roomId) => {
      if (!roomId) return;

      set((state) => {
        const key = buildChatRoomKey(roomType, roomId);
        const existing = state.rooms[key];
        if (!existing) return state;

        if (existing.mountCount > 1) {
          return {
            rooms: {
              ...state.rooms,
              [key]: {
                ...existing,
                mountCount: existing.mountCount - 1,
                lastTouchedAt: Date.now(),
                status: "active",
              },
            },
          };
        }

        const demotedRooms = {
          ...state.rooms,
          [key]: {
            ...existing,
            mountCount: 0,
            lastTouchedAt: Date.now(),
            status: "background" as const,
          },
        };

        return {
          rooms: evictOverflowRooms(demotedRooms, roomType),
        };
      });
    },

    touchRoom: (roomType, roomId) => {
      if (!roomId) return;

      set((state) => {
        const key = buildChatRoomKey(roomType, roomId);
        const existing = state.rooms[key];
        if (!existing) return state;

        return {
          rooms: {
            ...state.rooms,
            [key]: {
              ...existing,
              lastTouchedAt: Date.now(),
            },
          },
        };
      });
    },

    evictOverflow: (roomType) => {
      set((state) => ({
        rooms: evictOverflowRooms(state.rooms, roomType),
      }));
    },

    isTracked: (roomType, roomId) => {
      return Boolean(get().rooms[buildChatRoomKey(roomType, roomId)]);
    },

    isActive: (roomType, roomId) => {
      const room = get().rooms[buildChatRoomKey(roomType, roomId)];
      return Boolean(room && room.status === "active");
    },

    getTrackedRooms: () => {
      return getTrackedChatRooms(get().rooms);
    },

    getTrackedRoomIds: (roomType) => {
      return getTrackedChatRoomIds(get().rooms, roomType);
    },

    clear: () => {
      set({ rooms: {} });
    },
  }),
);

export function useMountedChatRoom(
  roomType: ChatRoomType,
  roomId: string | null | undefined,
) {
  const mountRoom = useChatRoomLifecycleStore((state) => state.mountRoom);
  const unmountRoom = useChatRoomLifecycleStore((state) => state.unmountRoom);

  useEffect(() => {
    if (!roomId) return;

    mountRoom(roomType, roomId);
    return () => {
      unmountRoom(roomType, roomId);
    };
  }, [mountRoom, roomId, roomType, unmountRoom]);
}
