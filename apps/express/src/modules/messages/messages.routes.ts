import { Router } from "express";
import {
  messageSelectFields,
  serializeMessageRecord,
  getPaginatedMessages,
  getMessagesByIds,
  getMessage,
  updateMessageContent,
  hardDeleteMessage,
  extractMentionIdentifiers,
  resolveMentionedChannelMemberProfileIds,
  createMentions,
  reserveChannelMessageSeqRange,
  advanceAuthorChannelReadState,
} from "./messages.service.js";
import { sendPushToProfiles } from "../push-notifications/push-notifications.service.js";
import {
  verifyMemberInBoardCached,
  findChannelCached,
  invalidateMemberCache,
} from "../../lib/cache.js";
import {
  AssetContext,
  AssetVisibility,
  MessageType,
} from "@prisma/client";
import { db } from "../../lib/db.js";
import {
  awardMemberXp,
  canSendChatImage,
  canSendLinks,
  canSendSticker,
  containsExternalLinks,
  hasMinimumMeaningfulTextLength,
  MEMBER_XP_REWARDS,
  REPUTATION_LIMITS,
  isModerator,
} from "../../lib/domain.js";
import { logger } from "../../lib/logger.js";
import { attachFilePreviews } from "../../lib/chat-image-previews.js";
import { findOwnedUploadedAsset } from "../../lib/uploaded-assets.js";

const router = Router();

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_MESSAGE_IDS = 200;

function getReputationScore(reputationScore: number | undefined): number {
  return typeof reputationScore === "number"
    ? reputationScore
    : REPUTATION_LIMITS.baseline;
}

function getMemberLevel(level: number | undefined): number {
  return typeof level === "number" ? level : 1;
}

function getAccessError(decision: {
  code?: "INSUFFICIENT_LEVEL" | "INSUFFICIENT_REPUTATION";
  requiredLevel?: number;
  requiredReputation?: number;
}) {
  if (decision.code === "INSUFFICIENT_LEVEL") {
    return {
      error: "INSUFFICIENT_LEVEL",
      requiredLevel: decision.requiredLevel ?? null,
    };
  }

  return {
    error: "INSUFFICIENT_REPUTATION",
    requiredReputation: decision.requiredReputation ?? null,
  };
}

// POST → Enviar Mensaje

router.post("/", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { boardId, channelId } = req.query;
    const { content, attachmentAssetId, stickerId, replyToId, tempId } =
      req.body;
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    const reputationScore = getReputationScore(req.profile?.reputationScore);

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!trimmedContent && !attachmentAssetId && !stickerId)
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
    const memberLevel = getMemberLevel(member.level);

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
    if (
      attachmentAssetId !== undefined &&
      attachmentAssetId !== null &&
      attachmentAssetId !== ""
    ) {
      if (
        typeof attachmentAssetId !== "string" ||
        !UUID_REGEX.test(attachmentAssetId)
      ) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      const attachmentAsset = await findOwnedUploadedAsset({
        assetId: attachmentAssetId,
        ownerProfileId: profileId,
        context: AssetContext.MESSAGE_ATTACHMENT,
        visibility: AssetVisibility.PRIVATE,
        boardId: boardId as string,
      });

      if (!attachmentAsset) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      resolvedAttachmentAssetId = attachmentAsset.id;
    }

    if (resolvedAttachmentAssetId) {
      const decision = canSendChatImage({
        level: memberLevel,
        reputationScore,
      });

      if (!decision.allowed) {
        return res.status(403).json(getAccessError(decision));
      }
    }

    if (stickerId) {
      const decision = canSendSticker({
        level: memberLevel,
        reputationScore,
      });

      if (!decision.allowed) {
        return res.status(403).json(getAccessError(decision));
      }
    }

    if (trimmedContent && containsExternalLinks(trimmedContent)) {
      const decision = canSendLinks(reputationScore);
      if (!decision.allowed) {
        return res.status(403).json(getAccessError(decision));
      }
    }

    let type: MessageType = MessageType.TEXT;
    if (stickerId) {
      type = MessageType.STICKER;
    } else if (resolvedAttachmentAssetId) {
      type = MessageType.IMAGE;
    }

    const message = await db.$transaction(async (tx) => {
      const reservedSeq = await reserveChannelMessageSeqRange(
        tx,
        channelId as string,
        1,
      );

      const createdMessage = await tx.message.create({
        data: {
          content: trimmedContent,
          attachmentAssetId: resolvedAttachmentAssetId,
          stickerId,
          channelId: channelId as string,
          seq: reservedSeq,
          memberId: member.id,
          messageSenderId: profileId,
          type,
          replyToId,
        },
        select: messageSelectFields,
      });

      await advanceAuthorChannelReadState(tx, {
        profileId,
        channelId: channelId as string,
        lastReadSeq: reservedSeq,
      });

      let memberTarget = {
        id: member.id,
        profileId: member.profileId,
        boardId: member.boardId,
        xp: typeof member.xp === "number" ? member.xp : 0,
        level: memberLevel,
      };

      if (hasMinimumMeaningfulTextLength(trimmedContent)) {
        const textReward = await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.chatText,
          reason: "CHAT_MESSAGE_TEXT",
          sourceType: "MESSAGE",
          sourceId: createdMessage.id,
        });

        memberTarget = {
          ...memberTarget,
          xp: textReward.nextXp,
          level: textReward.nextLevel,
        };
      }

      if (resolvedAttachmentAssetId) {
        const imageReward = await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.chatImage,
          reason: "CHAT_MESSAGE_ATTACHMENT",
          sourceType: "MESSAGE",
          sourceId: createdMessage.id,
        });

        memberTarget = {
          ...memberTarget,
          xp: imageReward.nextXp,
          level: imageReward.nextLevel,
        };
      }

      if (stickerId) {
        await awardMemberXp(tx, {
          member: memberTarget,
          delta: MEMBER_XP_REWARDS.sticker,
          reason: "CHAT_MESSAGE_STICKER",
          sourceType: "MESSAGE",
          sourceId: createdMessage.id,
        });
      }

      return serializeMessageRecord(createdMessage);
    });

    await invalidateMemberCache(profileId, boardId as string);

    // Usar el profile que ya viene del cache de member verification (evita query extra)
    const senderProfile = member.profile;

    // Procesar menciones si hay contenido
    if (trimmedContent) {
      const mentionIdentifiers = extractMentionIdentifiers(trimmedContent);
      const mentionedProfileIds = await resolveMentionedChannelMemberProfileIds(
        channelId as string,
        mentionIdentifiers,
        member.profileId,
      );

      if (mentionedProfileIds.length > 0) {
        // Crear las menciones en la base de datos
        await createMentions(message.id, mentionedProfileIds);

        // Emitir notificación a cada usuario mencionado
        for (const mentionedProfileId of mentionedProfileIds) {
          // No notificar si se menciona a sí mismo
          if (mentionedProfileId !== member.profileId) {
            req.io
              .to(`profile:${mentionedProfileId}`)
              .emit(`mention:${mentionedProfileId}`, {
                messageId: message.id,
                channelId,
                boardId,
                messageSeq: message.seq,
                sender: senderProfile,
                content: trimmedContent.substring(0, 100), // Preview del mensaje
              });
          }
        }

        // Push notifications para usuarios mencionados (fire-and-forget)
        const pushRecipients = mentionedProfileIds.filter(
          (id) => id !== member.profileId,
        );
        if (pushRecipients.length > 0) {
          sendPushToProfiles({
            profileIds: pushRecipients,
            notificationType: "MENTION",
            title: `${senderProfile.username} te mencionó`,
            body: trimmedContent.substring(0, 100),
            data: {
              messageId: message.id,
              channelId: channelId as string,
              boardId: boardId as string,
            },
          }).catch((err) => logger.error("[PUSH_MENTION]", err));
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
    req.io.to(`board-messages:${boardId}`).emit("global:channel:activity", {
      channelId,
      boardId,
      messageSeq: message.seq,
      senderProfileId: member.profileId,
    });

    // Incrementar el contador de no leídos en la base de datos para todos los miembros
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
    if (rawIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
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
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    const reputationScore = getReputationScore(req.profile?.reputationScore);

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!trimmedContent)
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

    if (containsExternalLinks(trimmedContent)) {
      const decision = canSendLinks(reputationScore);
      if (!decision.allowed) {
        return res.status(403).json(getAccessError(decision));
      }
    }

    let message = await getMessage(messageId, channelId as string);
    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    const isOwner = message.messageSenderId === profileId;
    if (!isOwner) return res.status(401).json({ error: "Unauthorized" });

    if (message.attachmentAssetId)
      return res.status(400).json({ error: "Cannot edit message with file" });

    if (message.sticker)
      return res.status(400).json({ error: "Cannot edit sticker message" });

    message = await updateMessageContent(messageId, trimmedContent);

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
    const memberIsModerator = isModerator(member.role);

    if (!isMessageOwner && !memberIsModerator)
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
    if (!isModerator(member.role)) {
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
    const serializedMessage = attachFilePreviews(
      serializeMessageRecord(message),
    );
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
    if (!isModerator(member.role)) {
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
    const serializedMessage = attachFilePreviews(
      serializeMessageRecord(message),
    );
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
