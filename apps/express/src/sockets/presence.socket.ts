// Presence socket handlers
import { Server, Socket } from "socket.io";
import { presenceManager } from "../lib/presence-manager.js";
import { getProfileBoardIdsCached } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

/**
 * Register presence-related socket event handlers
 */
export function registerPresenceHandlers(io: Server, socket: Socket) {
  // HEARTBEAT - Keeps presence active

  socket.on("presence:heartbeat", async () => {
    try {
      if (socket.data.profileId) {
        await presenceManager.renewPresence(socket.data.profileId, socket.id);
      }
    } catch (error) {
      logger.error(`Error in presence:heartbeat for ${socket.id}:`, error);
    }
  });

  // LOGOUT - User explicitly logs out

  socket.on("presence:logout", async () => {
    try {
      if (socket.data.profileId) {
        await presenceManager.forceOffline(socket.data.profileId);
      }
    } catch (error) {
      logger.error(`Error in presence:logout for ${socket.id}:`, error);
    }
  });

  // PAGE CLOSE - User closes the page/tab
  // Server will verify if it's the last connection

  socket.on("presence:page-close", async () => {
    try {
      if (socket.data.profileId) {
        const profileId = socket.data.profileId;

        // Mark that this socket wants to disconnect due to page close
        // We use a short timeout to give other tabs a chance to respond
        socket.data.pageClosing = true;

        // Force offline immediately (if user has other tabs,
        // their heartbeats will bring them back online)
        await presenceManager.forceOffline(profileId);
      }
    } catch (error) {
      logger.error(`Error in presence:page-close for ${socket.id}:`, error);
    }
  });
}

/**
 * Handle connection event for presence
 */
export async function handlePresenceConnect(io: Server, socket: Socket) {
  if (socket.data.profileId) {
    try {
      await presenceManager.userConnected(socket.data.profileId, socket.id);

      // Join profile room for DM notifications
      socket.join(`profile:${socket.data.profileId}`);

      // Join board-messages rooms for all boards the user belongs to
      const boardIds = await getProfileBoardIdsCached(socket.data.profileId);
      for (const boardId of boardIds) {
        socket.join(`board-messages:${boardId}`);
      }

      // Emit event that user is online
      io.emit("presence:user-online", {
        profileId: socket.data.profileId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error in connection handler for ${socket.id}:`, error);
    }
  }
}

/**
 * Handle disconnect event for presence
 */
export async function handlePresenceDisconnect(_socket: Socket) {
  // No marcamos offline inmediatamente al desconectar.
  // El TTL de Redis (120s) expirará si no hay heartbeats,
  // lo que permite reconexiones sin parpadeo de estado.
  // Redis Keyspace Notifications emitirá user-offline cuando la key expire.
}
