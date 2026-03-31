import { Router } from "express";
import {
  messageSelectFields,
  serializeMessageRecord,
  createMessage,
  getPaginatedMessages,
  getMessagesByIds,
  getMessage,
  updateMessageContent,
  hardDeleteMessage,
  extractMentionIdentifiers,
  resolveProfileIds,
  createMentions,
} from "./messages.service.js";
import {
  verifyMemberInBoardCached,
  findChannelCached,
} from "../../lib/cache.js";
import { incrementUnreadForChannel } from "../channel-read-state/channel-read-state.service.js";
import {
  AssetContext,
  AssetVisibility,
  MemberRole,
  MessageType,
} from "@prisma/client";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { attachFilePreviews } from "../../lib/chat-image-previews.js";
import { findOwnedUploadedAsset } from "../../lib/uploaded-assets.js";

const router = Router();

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_MESSAGE_IDS = 200;

// POST → Enviar Mensaje

router.post("/", async (req, res) => {
  const startTime = Date.now();
  try {
    const profileId = req.profile?.id;
    const { boardId, channelId } = req.query;
    const { content, attachmentAssetId, stickerId, replyToId, tempId } = req.body;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!content && !attachmentAssetId && !stickerId)
      return res.status(400).json({ error: "Content missing" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    const channelMember = await db.channelMember.findUnique({
      where: {
        channelId_profileId: {
          channelId: channelId as string,
          profileId,
        },
      },
      select: { id: true },
    });
    if (!channelMember)
      return res.status(403).json({ error: "Not a channel member" });

    let resolvedAttachmentAssetId: string | null = null;
    if (attachmentAssetId !== undefined && attachmentAssetId !== null && attachmentAssetId !== "") {
      if (typeof attachmentAssetId !== "string" || !UUID_REGEX.test(attachmentAssetId)) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      const attachmentAsset = await findOwnedUploadedAsset({
        assetId: attachmentAssetId,
        ownerProfileId: profileId,
        context: AssetContext.MESSAGE_ATTACHMENT,
        visibility: AssetVisibility.PRIVATE,
      });

      if (!attachmentAsset) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      resolvedAttachmentAssetId = attachmentAsset.id;
    }

    let type: MessageType = MessageType.TEXT;
    if (stickerId) {
      type = MessageType.STICKER;
    } else if (resolvedAttachmentAssetId) {
      type = MessageType.IMAGE;
    }

    const message = await createMessage({
      content: content || "",
      attachmentAssetId: resolvedAttachmentAssetId,
      stickerId,
      channelId: channelId as string,
      memberId: member.id,
      messageSenderId: profileId,
      type,
      replyToId,
    });

    // Usar el profile que ya viene del cache de member verification (evita query extra)
    const senderProfile = member.profile;

    // Procesar menciones si hay contenido
    if (content) {
      const mentionIdentifiers = extractMentionIdentifiers(content);
      const mentionedProfileIds = await resolveProfileIds(mentionIdentifiers);

      if (mentionedProfileIds.length > 0) {
        // Crear las menciones en la base de datos
        await createMentions(message.id, mentionedProfileIds);

        // Emitir notificación a cada usuario mencionado
        for (const mentionedProfileId of mentionedProfileIds) {
          // No notificar si se menciona a sí mismo
          if (mentionedProfileId !== member.profileId) {
            req.io.to(`profile:${mentionedProfileId}`).emit(`mention:${mentionedProfileId}`, {
              messageId: message.id,
              channelId,
              boardId,
              sender: senderProfile,
              content: content.substring(0, 100), // Preview del mensaje
            });
          }
        }
      }
    }

    const eventKey = `chat:${channelId}:messages`;
    const roomName = `channel:${channelId}`;

    // Debug: solo en desarrollo para ver cuántos clientes están en la sala
    if (process.env.NODE_ENV !== "production") {
      await req.io.in(roomName).fetchSockets();
    }

    const messageWithPreviews = attachFilePreviews(message);

    // Include tempId for optimistic message matching
    const messageWithTempId = tempId
      ? { ...messageWithPreviews, tempId }
      : messageWithPreviews;
    req.io.to(roomName).emit(eventKey, messageWithTempId);

    // Emitir evento global al board para notificaciones de usuarios en otros canales
    req.io.to(`board-messages:${boardId}`).emit("global:channel:message", {
      channelId,
      boardId,
      messageTimestamp: Date.now(), // timestamp para comparar con lastAck en cliente
      member: {
        ...member,
        profile: senderProfile,
      },
    });

    // Incrementar el contador de no leídos en la base de datos para todos los miembros
    await incrementUnreadForChannel(
      channelId as string,
      boardId as string,
      member.profileId,
    );

    return res.json(messageWithTempId);
  } catch (err) {
    logger.error("[MESSAGE_POST]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → Obtener mensajes (Paginado, Bidireccional)

router.get("/", async (req, res) => {
  try {
    const { channelId, boardId, cursor, direction } = req.query;
    // Header
    const profileId = req.profile?.id;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (cursor && !UUID_REGEX.test(cursor as string))
      return res.status(400).json({ error: "Invalid cursor" });

    // Usar findChannelCached para verificar que el canal existe y pertenece al board
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );

    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const dir = direction === "after" ? "after" : "before";

    const messages = await getPaginatedMessages(
      channelId as string,
      cursor as string | undefined,
      dir,
    );

    const items = messages.map((m) => attachFilePreviews(m));

    // Bidirectional cursors:
    // - nextCursor: ID of oldest message in this batch (for fetching older messages)
    // - previousCursor: ID of newest message in this batch (for fetching newer messages)
    //
    // When scrolling UP (loading history): use nextCursor
    // When scrolling DOWN (after eviction): use previousCursor
    const PAGE_SIZE = 40;
    const hasMore = messages.length === PAGE_SIZE;

    // Always provide both cursors when we have messages
    // This enables bidirectional pagination from any point
    const newestMessageId = messages[0]?.id || null;
    const oldestMessageId = messages[messages.length - 1]?.id || null;

    if (dir === "after") {
      // When fetching newer messages:
      // - previousCursor points to even NEWER messages (if there are more)
      // - nextCursor points to OLDER messages (always available since we came from older)
      const response = {
        items,
        previousCursor: hasMore ? newestMessageId : null,
        nextCursor: oldestMessageId,
      };
      return res.json(response);
    } else {
      // When fetching older messages (default):
      // - nextCursor points to even OLDER messages (if there are more)
      // - previousCursor points to NEWER messages (the first msg in this batch)
      return res.json({
        items,
        nextCursor: hasMore ? oldestMessageId : null,
        previousCursor: cursor ? newestMessageId : null, // Only if not initial load
      });
    }
  } catch (err) {
    logger.error("[MESSAGE_GET]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

router.post("/by-ids", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { channelId, boardId } = req.query;
    const rawIds = req.body?.ids;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: "Ids must be a non-empty array" });
    }
    if (rawIds.length > MAX_BATCH_MESSAGE_IDS) {
      return res.status(400).json({ error: "Too many message IDs" });
    }
    if (
      rawIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))
    ) {
      return res.status(400).json({ error: "Invalid message IDs" });
    }

    const ids = [...new Set(rawIds as string[])];
    if (ids.length === 0) {
      return res.status(400).json({ error: "No valid message IDs provided" });
    }

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const messages = await getMessagesByIds(channelId as string, ids);
    const foundIds = new Set(messages.map((message) => message.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));

    return res.json({
      items: messages.map((message) => attachFilePreviews(message)),
      missingIds,
    });
  } catch (err) {
    logger.error("[MESSAGE_BY_IDS_POST]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// PATCH → Editar Mensaje

router.patch("/:messageId", async (req, res) => {
  try {
    // Header
    const profileId = req.profile?.id;

    const { messageId } = req.params;
    const { boardId, channelId } = req.query;
    const { content } = req.body;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!content) return res.status(400).json({ error: "Content missing" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    let message = await getMessage(messageId, channelId as string);
    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    const isOwner = message.messageSenderId === profileId;
    if (!isOwner) return res.status(401).json({ error: "Unauthorized" });

    if (message.attachmentAssetId)
      return res.status(400).json({ error: "Cannot edit message with file" });

    if (message.sticker)
      return res.status(400).json({ error: "Cannot edit sticker message" });

    message = await updateMessageContent(messageId, content);

    const updateKey = `chat:${channelId}:messages:update`;
    req.io.to(`channel:${channelId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[MESSAGE_PATCH]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Borrar Mensaje

router.delete("/:messageId", async (req, res) => {
  try {
    // Header
    const profileId = req.profile?.id;

    const { messageId } = req.params;
    const { boardId, channelId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    let message = await getMessage(messageId, channelId as string);
    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    const isMessageOwner = message.messageSenderId === profileId;
    const isBoardOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isMessageOwner && !isBoardOwner && !isAdmin && !isModerator)
      return res.status(401).json({ error: "Unauthorized" });

    // Hard delete the message from DB
    await hardDeleteMessage(messageId);

    // Emit update with deleted: true so clients remove it from cache
    const updateKey = `chat:${channelId}:messages:update`;
    req.io
      .to(`channel:${channelId}`)
      .emit(updateKey, { id: messageId, deleted: true });

    return res.json({ success: true, id: messageId });
  } catch (error) {
    logger.error("[MESSAGE_DELETE]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// POST → Pin Message

router.post("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Check permissions (only admins, mods, or owner can pin)
    const isOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isOwner && !isAdmin && !isModerator) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Ensure the target message belongs to the validated channel
    const originalMessage = await db.message.findFirst({
      where: {
        id: messageId,
        channelId: channelId as string,
      },
      select: { updatedAt: true },
    });

    if (!originalMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    const message = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: profileId,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      select: messageSelectFields,
    });

    const updateKey = `chat:${channelId}:messages:update`;
    const serializedMessage = attachFilePreviews(serializeMessageRecord(message));
    req.io.to(`channel:${channelId}`).emit(updateKey, serializedMessage);

    return res.json(serializedMessage);
  } catch (error) {
    logger.error("[MESSAGE_PIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Unpin Message

router.delete("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Check permissions
    const isOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isOwner && !isAdmin && !isModerator) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Ensure the target message belongs to the validated channel
    const originalMessage = await db.message.findFirst({
      where: {
        id: messageId,
        channelId: channelId as string,
      },
      select: { updatedAt: true },
    });

    if (!originalMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    const message = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: false,
        pinnedAt: null,
        pinnedById: null,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      select: messageSelectFields,
    });

    const updateKey = `chat:${channelId}:messages:update`;
    const serializedMessage = attachFilePreviews(serializeMessageRecord(message));
    req.io.to(`channel:${channelId}`).emit(updateKey, serializedMessage);

    return res.json(serializedMessage);
  } catch (error) {
    logger.error("[MESSAGE_UNPIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → Get Pinned Messages

router.get("/pinned", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const pinnedMessages = await db.message.findMany({
      where: {
        channelId: channelId as string,
        pinned: true,
        deleted: false,
      },
      take: 20,
      orderBy: { pinnedAt: "desc" },
      select: messageSelectFields,
    });

    return res.json(
      pinnedMessages.map((message) =>
        attachFilePreviews(serializeMessageRecord(message)),
      ),
    );
  } catch (error) {
    logger.error("[GET_PINNED_MESSAGES]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
