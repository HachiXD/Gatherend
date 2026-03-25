"use client";

import type { Socket } from "socket.io-client";

const boardRoomRefCounts = new WeakMap<Socket, Map<string, number>>();

function getBoardRoomRefCounts(socket: Socket): Map<string, number> {
  const existing = boardRoomRefCounts.get(socket);
  if (existing) return existing;

  const next = new Map<string, number>();
  boardRoomRefCounts.set(socket, next);
  return next;
}

export function acquireBoardRoom(socket: Socket, boardId: string): void {
  const refCounts = getBoardRoomRefCounts(socket);
  const nextCount = (refCounts.get(boardId) ?? 0) + 1;
  refCounts.set(boardId, nextCount);

  if (nextCount === 1) {
    socket.emit("join-board", { boardId });
  }
}

export function releaseBoardRoom(socket: Socket, boardId: string): void {
  const refCounts = boardRoomRefCounts.get(socket);
  const currentCount = refCounts?.get(boardId);

  if (!refCounts || !currentCount) return;

  if (currentCount === 1) {
    refCounts.delete(boardId);
    socket.emit("leave-board", { boardId });
    if (refCounts.size === 0) {
      boardRoomRefCounts.delete(socket);
    }
    return;
  }

  refCounts.set(boardId, currentCount - 1);
}

export function rejoinBoardRooms(socket: Socket): void {
  const refCounts = boardRoomRefCounts.get(socket);
  if (!refCounts) return;

  refCounts.forEach((_count, boardId) => {
    socket.emit("join-board", { boardId });
  });
}
