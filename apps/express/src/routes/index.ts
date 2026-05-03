// Routes registration - All HTTP endpoints
import express from "express";
import { Server } from "socket.io";
import messageRoutes from "../modules/messages/messages.routes.js";
import directMessageRoutes from "../modules/direct-messages/direct-messages.routes.js";
import stickerRoutes from "../modules/stickers/stickers.routes.js";
import reactionRoutes from "../modules/reactions/reactions.routes.js";
import channelReadStateRoutes from "../modules/channel-read-state/channel-read-state.routes.js";
import conversationReadStateRoutes from "../modules/conversation-read-state/conversation-read-state.routes.js";
import linkPreviewRoutes from "../modules/link-preview/link-preview.routes.js";
import profileRoutes from "../modules/profiles/profiles.routes.js";
import uploadRoutes from "../modules/upload/upload.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import pushTokenRoutes from "../modules/push-notifications/push-notifications.routes.js";
import { authenticateRequest } from "../middleware/auth.js";
import {
  messageRateLimit,
  reactionRateLimit,
  uploadRateLimit,
  presenceRateLimit,
  emitRateLimit,
  pushTokenRateLimit,
} from "../middleware/rate-limit.js";
import { presenceManager } from "../lib/presence-manager.js";
import { logger } from "../lib/logger.js";

// Middleware para validar requests internos (Next.js → Express)
const validateInternalSecret = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

/**
 * Register all HTTP routes
 */
export function registerRoutes(app: express.Application, io: Server) {
  // MODULE ROUTES

  // Messages
  app.use(
    "/messages",
    authenticateRequest,
    (req, res, next) => {
      req.io = io;
      next();
    },
    (req, res, next) => {
      if (req.method === "POST") {
        return messageRateLimit(req, res, next);
      }
      next();
    },
    messageRoutes,
  );

  // Direct Messages
  app.use(
    "/direct-messages",
    authenticateRequest,
    (req, res, next) => {
      req.io = io;
      next();
    },
    (req, res, next) => {
      if (req.method === "POST") {
        return messageRateLimit(req, res, next);
      }
      next();
    },
    directMessageRoutes,
  );

  // Stickers (with upload rate limit)
  app.use("/stickers", uploadRateLimit, authenticateRequest, stickerRoutes);

  // Upload (with upload rate limit)
  app.use("/upload", uploadRateLimit, authenticateRequest, uploadRoutes);

  // Media transforms (public - no auth)
  app.use("/media", mediaRoutes);

  // Reactions
  app.use(
    "/reactions",
    authenticateRequest,
    reactionRateLimit,
    (req, res, next) => {
      req.io = io;
      next();
    },
    reactionRoutes,
  );

  // Channel Read State
  app.use(
    "/channel-read-state",
    authenticateRequest,
    (req, res, next) => {
      req.io = io;
      next();
    },
    channelReadStateRoutes,
  );

  // Conversation Read State
  app.use(
    "/conversation-read-state",
    authenticateRequest,
    (req, res, next) => {
      req.io = io;
      next();
    },
    conversationReadStateRoutes,
  );

  // Link Preview (public - no auth)
  app.use("/link-preview", linkPreviewRoutes);

  // Profiles
  app.use("/profiles", authenticateRequest, profileRoutes);

  // Push Tokens
  app.use("/push-tokens", authenticateRequest, pushTokenRateLimit, pushTokenRoutes);

  // PRESENCE ENDPOINTS

  // Check presence for multiple users
  app.post(
    "/presence/check",
    authenticateRequest,
    presenceRateLimit,
    async (req, res) => {
      try {
        const { profileIds } = req.body;

        if (!Array.isArray(profileIds)) {
          return res
            .status(400)
            .json({ error: "profileIds debe ser un array" });
        }

        const presenceInfo = await presenceManager.getPresenceInfo(profileIds);

        res.json({
          presence: presenceInfo,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error al verificar presencia:", error);
        res.status(500).json({ error: "Error al verificar presencia" });
      }
    },
  );

  // Get all online users
  app.get(
    "/presence/online",
    authenticateRequest,
    presenceRateLimit,
    async (req, res) => {
      try {
        const onlineUsers = await presenceManager.getAllOnlineUsers();
        const count = await presenceManager.getOnlineCount();

        res.json({
          onlineUsers,
          count,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error al obtener usuarios online:", error);
        res.status(500).json({ error: "Error al obtener usuarios online" });
      }
    },
  );

  // HEALTH CHECK

  app.get("/health", async (req, res) => {
    const onlineCount = await presenceManager.getOnlineCount();
    res.json({
      status: "ok",
      connections: io.engine.clientsCount,
      onlineUsers: onlineCount,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // INTERNAL EMIT ENDPOINTS (Next.js → Express)

  // Emit to a channel key
  app.post("/emit", validateInternalSecret, emitRateLimit, (req, res) => {
    try {
      const { channelKey, data } = req.body;

      if (!channelKey) {
        return res.status(400).json({
          error: "channelKey es requerido",
          example: {
            channelKey: "chat:123:messages",
            data: { message: "ejemplo" },
          },
        });
      }

      io.emit(channelKey, data);

      res.json({
        success: true,
        channelKey,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al emitir evento:", error);
      res.status(500).json({
        error: "Error al emitir evento",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Emit to a specific room
  app.post(
    "/emit-to-room",
    validateInternalSecret,
    emitRateLimit,
    (req, res) => {
      try {
        const { room, event, data } = req.body;

        if (!room || !event) {
          return res.status(400).json({
            error: "room y event son requeridos",
            example: {
              room: "channel:123",
              event: "new-message",
              data: { message: "ejemplo" },
            },
          });
        }

        io.to(room).emit(event, data);

        res.json({
          success: true,
          room,
          event,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error al emitir a sala:", error);
        res.status(500).json({
          error: "Error al emitir a sala",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Move a profile's sockets into or out of a board-messages room
  app.post(
    "/socket-membership",
    validateInternalSecret,
    emitRateLimit,
    (req, res) => {
      try {
        const { profileId, boardId, action } = req.body;

        if (!profileId || !boardId || !action) {
          return res.status(400).json({ error: "profileId, boardId y action son requeridos" });
        }

        if (action !== "join" && action !== "leave") {
          return res.status(400).json({ error: "action debe ser 'join' o 'leave'" });
        }

        const room = `board-messages:${boardId}`;
        if (action === "join") {
          io.in(`profile:${profileId}`).socketsJoin(room);
        } else {
          io.in(`profile:${profileId}`).socketsLeave(room);
        }

        res.json({ success: true, action, profileId, boardId });
      } catch (error) {
        logger.error("Error en socket-membership:", error);
        res.status(500).json({
          error: "Error en socket-membership",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  logger.info("HTTP routes registered");
}
