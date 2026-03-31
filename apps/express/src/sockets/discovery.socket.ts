// Discovery feed socket handlers
import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger.js";

function isSocketPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadId(payload: unknown, key: string): string | null {
  if (!isSocketPayload(payload)) return null;
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Register discovery feed socket event handlers
 */
export function registerDiscoveryHandlers(io: Server, socket: Socket) {
  // SUBSCRIBE - User subscribes to a board's discovery feed

  socket.on("discovery:subscribe", (payload?: unknown) => {
    try {
      const boardId = getPayloadId(payload, "boardId");
      if (!boardId) return;

      const roomName = `discovery:board:${boardId}`;
      socket.join(roomName);
    } catch (error) {
      logger.error(`Error in discovery:subscribe for ${socket.id}:`, error);
    }
  });

  // UNSUBSCRIBE - User unsubscribes from a board's discovery feed

  socket.on("discovery:unsubscribe", (payload?: unknown) => {
    try {
      const boardId = getPayloadId(payload, "boardId");
      if (!boardId) return;

      const roomName = `discovery:board:${boardId}`;
      socket.leave(roomName);
    } catch (error) {
      logger.error(`Error in discovery:unsubscribe for ${socket.id}:`, error);
    }
  });
}
