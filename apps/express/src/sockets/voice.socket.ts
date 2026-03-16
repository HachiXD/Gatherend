// Voice channel socket handlers
import { Server, Socket } from "socket.io";
import { voiceParticipantsManager } from "../lib/voice-participants-manager.js";
import {
  getChannelByIdCached,
  verifyMemberInBoardCached,
  findConversationForProfileCached,
  getVoiceChannelIdsCached,
} from "../lib/cache.js";
import { logger } from "../lib/logger.js";

// Grace period to avoid false "voice leave" when the Socket.IO transport drops briefly
// while LiveKit remains connected. The client will re-sync `voice-join` on reconnect.
const VOICE_DISCONNECT_GRACE_MS = 90_000;

const pendingVoiceDisconnects = new Map<string, NodeJS.Timeout>();

function getVoiceDisconnectKey(channelId: string, profileId: string): string {
  return `${channelId}:${profileId}`;
}

function clearPendingVoiceDisconnect(channelId: string, profileId: string) {
  const key = getVoiceDisconnectKey(channelId, profileId);
  const timer = pendingVoiceDisconnects.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingVoiceDisconnects.delete(key);
  }
}

function isSocketPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPayloadValue(payload: unknown, key: string): unknown {
  if (!isSocketPayload(payload)) return undefined;
  return payload[key];
}

function getPayloadId(payload: unknown, key: string): string | null {
  return getNonEmptyString(getPayloadValue(payload, key));
}

function getSocketProfileId(socket: Socket): string | null {
  return getNonEmptyString(socket.data?.profileId);
}

function getSocketUsername(socket: Socket): string {
  return getNonEmptyString(socket.data?.username) ?? "Usuario";
}

/**
 * Register voice-related socket event handlers
 */
export function registerVoiceHandlers(io: Server, socket: Socket) {
  // USER JOINS VOICE CHANNEL

  socket.on("voice-join", async (payload?: unknown) => {
    let channelId: string | null = null;
    try {
      channelId = getPayloadId(payload, "channelId");
      const profileId = getSocketProfileId(socket);
      const context = getPayloadId(payload, "context");
      const username =
        getPayloadId(payload, "username") ?? getSocketUsername(socket);
      const avatarUrl = getNonEmptyString(getPayloadValue(payload, "avatarUrl"));
      const usernameColor = getNonEmptyString(
        getPayloadValue(payload, "usernameColor"),
      );

      if (!channelId || !profileId) {
        socket.emit("voice-error", {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
          channelId: channelId || null,
        });
        return;
      }

      // If we had a pending disconnect cleanup for this participant, cancel it.
      // This happens when the Socket.IO transport drops transiently and reconnects.
      clearPendingVoiceDisconnect(channelId, profileId);

      // Conversation voice calls are keyed by conversationId, which won't exist in Channel.
      // Use payload context when available; otherwise fall back to "try channel, then conversation".
      const isConversationContext = context === "conversation";

      let boardId: string | null = null;
      if (!isConversationContext) {
        // SECURITY: Verify channel exists and get boardId
        const channel = await getChannelByIdCached(channelId);
        if (channel) {
          boardId = getNonEmptyString(
            (channel as { boardId?: unknown }).boardId,
          );
          if (!boardId) {
            socket.emit("voice-error", {
              code: "CHANNEL_NOT_FOUND",
              message: "Voice channel not found",
              channelId,
            });
            return;
          }

          // SECURITY: Verify user is member of the board
          const board = await verifyMemberInBoardCached(profileId, boardId);
          if (!board) {
            logger.warn(
              `User ${profileId} tried to join voice channel ${channelId} without board membership`,
            );
            socket.emit("voice-error", {
              code: "NOT_A_MEMBER",
              message: "You are not a member of this board",
              channelId,
            });
            return;
          }
        } else {
          // Not a channel. Treat it as a conversation voice call if the user is a participant.
          const conversation = await findConversationForProfileCached(
            profileId,
            channelId,
          );
          if (!conversation) {
            socket.emit("voice-error", {
              code: "CHANNEL_NOT_FOUND",
              message: "Voice channel not found",
              channelId,
            });
            return;
          }
        }
      } else {
        // Explicit conversation context - verify membership.
        const conversation = await findConversationForProfileCached(
          profileId,
          channelId,
        );
        if (!conversation) {
          socket.emit("voice-error", {
            code: "CHANNEL_NOT_FOUND",
            message: "Voice channel not found",
            channelId,
          });
          return;
        }
      }

      // Try to add participant (includes limit check)
      const result = await voiceParticipantsManager.addParticipant(channelId, {
        profileId,
        username,
        avatarUrl,
        usernameColor,
      });

      // If channel is full, emit error and don't proceed
      if (!result.success) {
        logger.warn(
          `User ${username} cannot join voice channel ${channelId}: ${result.reason}`,
        );
        socket.emit("voice-error", {
          code: result.reason,
          message:
            result.reason === "CHANNEL_FULL"
              ? "This voice channel is full (max 50 participants)"
              : "Failed to join voice channel",
          channelId,
        });
        return;
      }

      // Join voice channel room
      socket.join(`voice:${channelId}`);

      // Save user info in socket
      socket.data.voiceChannelId = channelId;
      socket.data.voiceBoardId = boardId;
      socket.data.voiceContext = boardId ? "board" : "conversation";

      const joinEvent = {
        channelId,
        participant: {
          profileId,
          username,
          avatarUrl,
          usernameColor,
        },
      };

      if (boardId) {
        // Debug log: see how many sockets are in the board room
        const roomName = `board:${boardId}`;
        const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
        const socketCount = socketsInRoom ? socketsInRoom.size : 0;
        logger.info(
          `Emitting voice:join to ${roomName} (${socketCount} sockets in room)`,
        );

        // Emit to entire board that someone joined (including the user themselves)
        io.to(roomName).emit(`voice:${boardId}:join`, joinEvent);

        // Also emit directly to the joining socket only if they're not in the board room yet.
        // Avoids duplicate join events when the client is already in `board:${boardId}`.
        if (!socket.rooms.has(roomName)) {
          socket.emit(`voice:${boardId}:join`, joinEvent);
        }
      } else {
        const roomName = `conversation:${channelId}`;
        io.to(roomName).emit(`voice:conversation:${channelId}:join`, joinEvent);
        if (!socket.rooms.has(roomName)) {
          socket.emit(`voice:conversation:${channelId}:join`, joinEvent);
        }
      }
    } catch (error) {
      logger.error("Error in voice-join:", error);
      socket.emit("voice-error", {
        code: "INTERNAL_ERROR",
        message: "Failed to join voice channel",
        channelId: channelId || null,
      });
    }
  });

  // USER LEAVES VOICE CHANNEL

  socket.on("voice-leave", async (payload?: unknown) => {
    try {
      const channelId =
        getPayloadId(payload, "channelId") ??
        getNonEmptyString(socket.data.voiceChannelId);
      const payloadBoardId = getPayloadId(payload, "boardId");
      const socketBoardId = getNonEmptyString(socket.data.voiceBoardId);
      const payloadContext = getPayloadId(payload, "context");
      const socketContext = getNonEmptyString(socket.data.voiceContext);

      if (!channelId) return;

      // SECURITY: Use profileId from socket, not from payload
      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        logger.warn(
          `voice-leave rejected: no profileId for socket ${socket.id}`,
        );
        return;
      }

      // If a disconnect cleanup was pending, clear it since this is an explicit leave.
      clearPendingVoiceDisconnect(channelId, profileId);

      // Leave voice channel room
      socket.leave(`voice:${channelId}`);

      // Clear socket info
      socket.data.voiceChannelId = null;
      socket.data.voiceBoardId = null;
      socket.data.voiceContext = null;

      // Remove participant from Redis (or memory as fallback)
      await voiceParticipantsManager.removeParticipant(channelId, profileId);

      // If participant still exists, it means this socket is stale (another active socket/device overwrote it).
      // Avoid emitting "leave" which would desync other clients.
      const stillInChannel = await voiceParticipantsManager.isInChannel(
        channelId,
        profileId,
      );
      if (stillInChannel) {
        return;
      }

      const effectiveContext = payloadContext ?? socketContext;

      // Use boardId from client or from socket data (avoids DB query)
      const effectiveBoardId = payloadBoardId ?? socketBoardId;

      if (effectiveBoardId) {
        const leaveEvent = {
          channelId,
          profileId,
        };

        // Emit to entire board that someone left
        const roomName = `board:${effectiveBoardId}`;
        io.to(roomName).emit(`voice:${effectiveBoardId}:leave`, leaveEvent);

        // Only emit directly if they're not in the board room (avoid duplicates).
        if (!socket.rooms.has(roomName)) {
          socket.emit(`voice:${effectiveBoardId}:leave`, leaveEvent);
        }
      } else if (effectiveContext === "conversation") {
        const roomName = `conversation:${channelId}`;
        const leaveEvent = { channelId, profileId };
        io.to(roomName).emit(
          `voice:conversation:${channelId}:leave`,
          leaveEvent,
        );
        if (!socket.rooms.has(roomName)) {
          socket.emit(`voice:conversation:${channelId}:leave`, leaveEvent);
        }
      } else {
        // Fallback: get boardId from cache (or DB if not in cache)
        const channel = await getChannelByIdCached(channelId);
        const boardId = channel
          ? getNonEmptyString((channel as { boardId?: unknown }).boardId)
          : null;

        if (boardId) {
          const leaveEvent = { channelId, profileId };
          const roomName = `board:${boardId}`;
          io.to(roomName).emit(`voice:${boardId}:leave`, leaveEvent);
          if (!socket.rooms.has(roomName)) {
            socket.emit(`voice:${boardId}:leave`, leaveEvent);
          }

        }
      }
    } catch (error) {
      logger.error("Error in voice-leave:", error);
    }
  });

  // GET PARTICIPANTS FOR A SPECIFIC CHANNEL

  socket.on("voice-get-participants", async (payload?: unknown) => {
    try {
      const channelId = getPayloadId(payload, "channelId");
      const context = getPayloadId(payload, "context");

      if (!channelId) {
        socket.emit("voice-error", {
          code: "CHANNEL_NOT_FOUND",
          message: "Voice channel not found",
          channelId: null,
        });
        return;
      }

      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        socket.emit("voice-error", {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
          channelId,
        });
        return;
      }

      const isConversationContext = context === "conversation";

      let boardId: string | null = null;
      if (!isConversationContext) {
        // SECURITY: Get the channel to verify boardId
        const channel = await getChannelByIdCached(channelId);
        if (channel) {
          boardId = getNonEmptyString(
            (channel as { boardId?: unknown }).boardId,
          );
          if (!boardId) {
            socket.emit("voice-error", {
              code: "CHANNEL_NOT_FOUND",
              message: "Voice channel not found",
              channelId,
            });
            return;
          }

          const board = await verifyMemberInBoardCached(profileId, boardId);
          if (!board) {
            logger.warn(
              `User ${profileId} tried to get voice participants for channel ${channelId} without board membership`,
            );
            socket.emit("voice-error", {
              code: "NOT_A_MEMBER",
              message: "You are not a member of this board",
              channelId,
            });
            return;
          }
        } else {
          // Not a channel. Treat it as a conversation if the user is a participant.
          const conversation = await findConversationForProfileCached(
            profileId,
            channelId,
          );
          if (!conversation) {
            socket.emit("voice-error", {
              code: "CHANNEL_NOT_FOUND",
              message: "Voice channel not found",
              channelId,
            });
            return;
          }
        }
      } else {
        const conversation = await findConversationForProfileCached(
          profileId,
          channelId,
        );
        if (!conversation) {
          socket.emit("voice-error", {
            code: "CHANNEL_NOT_FOUND",
            message: "Voice channel not found",
            channelId,
          });
          return;
        }
      }

      const participantsList =
        await voiceParticipantsManager.getParticipants(channelId);

      // Always respond directly to the requesting socket
      socket.emit("voice-participants-response", {
        channelId,
        participants: participantsList,
      });

      if (boardId) {
        // Use the boardId from validated channel
        socket.emit(`voice:${boardId}:participants`, {
          channelId,
          participants: participantsList,
        });
      } else {
        socket.emit(`voice:conversation:${channelId}:participants`, {
          channelId,
          participants: participantsList,
        });
      }
    } catch (error) {
      logger.error("Error in voice-get-participants:", error);
    }
  });

  // GET ALL VOICE PARTICIPANTS FOR A BOARD

  socket.on("voice-get-board-participants", async (payload?: unknown) => {
    try {
      const boardId = getPayloadId(payload, "boardId");
      if (!boardId) return;

      // SECURITY: Verify user is member of the board
      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        logger.warn("voice-get-board-participants: No profileId in socket");
        return;
      }

      const isMember = await verifyMemberInBoardCached(profileId, boardId);
      if (!isMember) {
        logger.warn(
          `voice-get-board-participants: User ${profileId} not member of board ${boardId}`,
        );
        return;
      }

      // Get all voice channels for the board (CACHED)
      const channelIds = await getVoiceChannelIdsCached(boardId);

      // Send participants for each channel (even if empty)
      for (const rawChannelId of channelIds) {
        const channelId = getNonEmptyString(rawChannelId);
        if (!channelId) continue;

        const participantsList =
          await voiceParticipantsManager.getParticipants(channelId);

        socket.emit(`voice:${boardId}:participants`, {
          channelId,
          participants: participantsList,
        });
      }
    } catch (error) {
      logger.error("Error in voice-get-board-participants:", error);
    }
  });
}

/**
 * Handle disconnect event for voice (cleanup)
 */
export async function handleVoiceDisconnect(
  io: Server,
  socket: Socket,
  reason?: string,
) {
  const channelId = getNonEmptyString(socket.data.voiceChannelId);
  const profileId = getSocketProfileId(socket);

  if (channelId && profileId) {
    const key = getVoiceDisconnectKey(channelId, profileId);

    // Avoid duplicate scheduled cleanups for the same participant.
    if (pendingVoiceDisconnects.has(key)) return;

    const boardId = getNonEmptyString(socket.data.voiceBoardId);
    const context = getNonEmptyString(socket.data.voiceContext);
    const pageClosing = Boolean(socket.data?.pageClosing);

    const immediate =
      pageClosing ||
      reason === "client namespace disconnect" ||
      reason === "server namespace disconnect" ||
      reason === "server shutting down";

    const performCleanup = async () => {
      pendingVoiceDisconnects.delete(key);

      try {
        await voiceParticipantsManager.removeParticipant(channelId, profileId);

        // If the participant is still present after the remove attempt, do not emit leave.
        // This happens with multi-server reconnects or multiple sockets where another connection owns the entry.
        const stillInChannel = await voiceParticipantsManager.isInChannel(
          channelId,
          profileId,
        );
        if (stillInChannel) {
          return;
        }

        const leaveEvent = { channelId, profileId };

        if (boardId) {
          io.to(`board:${boardId}`).emit(`voice:${boardId}:leave`, leaveEvent);
          return;
        }

        if (context === "conversation") {
          io.to(`conversation:${channelId}`).emit(
            `voice:conversation:${channelId}:leave`,
            leaveEvent,
          );
          return;
        }

        // Fallback: get boardId from cache (or DB if not in cache)
        const channel = await getChannelByIdCached(channelId);
        const fallbackBoardId = channel
          ? getNonEmptyString((channel as { boardId?: unknown }).boardId)
          : null;

        if (fallbackBoardId) {
          io.to(`board:${fallbackBoardId}`).emit(
            `voice:${fallbackBoardId}:leave`,
            leaveEvent,
          );
        }
      } catch (error) {
        logger.error("Error emitting voice-leave on disconnect:", error);
      }
    };

    if (immediate) {
      await performCleanup();
      return;
    }

    const timer = setTimeout(() => {
      void performCleanup();
    }, VOICE_DISCONNECT_GRACE_MS);

    pendingVoiceDisconnects.set(key, timer);
  }
}
