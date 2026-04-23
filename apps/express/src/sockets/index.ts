// Main socket handler - registers all socket event handlers
import { Server, Socket } from "socket.io";
import {
  registerPresenceHandlers,
  handlePresenceConnect,
  handlePresenceDisconnect,
} from "./presence.socket.js";
import { registerVoiceHandlers, handleVoiceDisconnect } from "./voice.socket.js";
import { registerRoomHandlers } from "./rooms.socket.js";
import { registerProfileHandlers } from "./profile.socket.js";
import { registerMessageSocket } from "../modules/messages/messages.socket.js";
import { registerDirectMessageSocket } from "../modules/direct-messages/direct-messages.socket.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { AuthProvider } from "@prisma/client";
import { getProfileByIdentityCached } from "../lib/cache.js";
import { getBetterAuth, toHeaders } from "../lib/better-auth.js";

async function tryBetterAuthSocket(
  socket: Socket,
): Promise<{ userId: string; profile: any } | null> {
  try {
    const auth = await getBetterAuth();
    const session = await auth.api.getSession({
      headers: toHeaders(socket.handshake.headers as Record<string, any>),
    });

    const providerUserId = session?.user?.id as string | undefined;
    if (!providerUserId) return null;

    const profile =
      (await getProfileByIdentityCached({
        provider: AuthProvider.BETTER_AUTH,
        providerUserId,
      })) ||
      (await db.profile.findUnique({
        where: { userId: providerUserId },
        select: {
          id: true,
          userId: true,
          username: true,
          email: true,
          banned: true,
          bannedAt: true,
          banReason: true,
        },
      }));

    if (!profile) return null;

    return { userId: providerUserId, profile };
  } catch {
    return null;
  }
}

/**
 * Configure Socket.IO authentication middleware
 */
export function configureSocketAuth(io: Server) {
  io.use(async (socket, next) => {
    try {
      const profileId = socket.handshake.auth?.profileId;
      const isDevelopment = process.env.NODE_ENV !== "production";

      if (!isDevelopment) {
        const result = await tryBetterAuthSocket(socket);
        if (!result) {
          logger.warn("[Socket] Rejected: missing session");
          return next(new Error("Authentication required"));
        }

        const profile = result.profile;
        if (profile.banned) {
          logger.warn(
            `[Socket] Rejected: banned profileId=${profile.id} username=${profile.username}`,
          );
          return next(new Error("Account suspended"));
        }

        if (profileId && profileId !== profile.id) {
          logger.warn(
            `[Socket] Rejected: profileId mismatch sent=${profileId} actual=${profile.id}`,
          );
          return next(new Error("Invalid profile"));
        }

        socket.data.profileId = profile.id;
        socket.data.username = profile.username;
        socket.data.userId = result.userId;

        return next();
      }

      // Development: allow fallback with profileId (for easier testing)
      if (profileId) {
        logger.warn(`[DEV ONLY] Socket using profileId fallback: ${profileId}`);
        socket.data.profileId = profileId;

        const profile = await db.profile.findUnique({
          where: { id: profileId },
          select: { username: true },
        });

        if (profile) {
          socket.data.username = profile.username;
        }
      } else {
        logger.warn(`[Socket] Missing profileId (dev): socketId=${socket.id}`);
      }

      next();
    } catch (error) {
      logger.error("Error in auth middleware:", error);
      next(new Error("Authentication error"));
    }
  });
}

/**
 * Register all socket event handlers
 */
export function registerSocketHandlers(io: Server) {
  // Configure authentication middleware
  configureSocketAuth(io);

  // Handle WebSocket connections
  io.on("connection", async (socket: Socket) => {
    // Handle presence on connect
    await handlePresenceConnect(io, socket);

    // Register all event handlers
    registerPresenceHandlers(io, socket);
    registerVoiceHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerProfileHandlers(io, socket);
    // Handle disconnection
    socket.on("disconnect", async (reason) => {
      await handleVoiceDisconnect(io, socket, reason);
      await handlePresenceDisconnect(socket);
    });

    socket.on("error", (error) => {
      logger.error(`[Socket] Error ${socket.id}:`, error);
    });
  });

  // Register module-specific socket handlers (for emitting from HTTP routes)
  registerMessageSocket(io);
  registerDirectMessageSocket(io);

  logger.info("Socket handlers registered");
}

