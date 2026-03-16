import express from "express";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { verifyMemberInBoardCached } from "../../lib/cache.js";
import { findConversationForProfile } from "../direct-messages/direct-messages.service.js";
import { uploadedAssetSelect } from "../../lib/uploaded-assets.js";

const router = express.Router();

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveReactionScope(input: {
  profileId: string;
  messageId?: string;
  directMessageId?: string;
}): Promise<
  | { kind: "message"; messageId: string; channelId: string; boardId: string }
  | { kind: "directMessage"; directMessageId: string; conversationId: string }
  | null
> {
  const { profileId, messageId, directMessageId } = input;

  if (messageId) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        channelId: true,
        channel: { select: { boardId: true } },
      },
    });

    if (!message?.channelId || !message.channel?.boardId) return null;

    const board = await verifyMemberInBoardCached(profileId, message.channel.boardId);
    if (!board) return null;

    return {
      kind: "message",
      messageId,
      channelId: message.channelId,
      boardId: message.channel.boardId,
    };
  }

  if (directMessageId) {
    const dm = await db.directMessage.findUnique({
      where: { id: directMessageId },
      select: { conversationId: true },
    });
    if (!dm?.conversationId) return null;

    const conversation = await findConversationForProfile(profileId, dm.conversationId);
    if (!conversation) return null;

    return {
      kind: "directMessage",
      directMessageId,
      conversationId: dm.conversationId,
    };
  }

  return null;
}

// POST /reactions - Add reaction to message or DM
router.post("/", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { emoji, messageId, directMessageId } = req.body;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!emoji) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hasMessageId = Boolean(messageId);
    const hasDirectMessageId = Boolean(directMessageId);
    if (hasMessageId === hasDirectMessageId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate UUID format
    if (messageId && (typeof messageId !== "string" || !UUID_REGEX.test(messageId))) {
      return res.status(400).json({ error: "Invalid message ID" });
    }
    if (
      directMessageId &&
      (typeof directMessageId !== "string" || !UUID_REGEX.test(directMessageId))
    ) {
      return res.status(400).json({ error: "Invalid direct message ID" });
    }

    // Validate emoji (max 10 chars, basic sanitization)
    if (typeof emoji !== "string" || emoji.length > 10) {
      return res.status(400).json({ error: "Invalid emoji" });
    }

    const scope = await resolveReactionScope({
      profileId,
      messageId: typeof messageId === "string" ? messageId : undefined,
      directMessageId:
        typeof directMessageId === "string" ? directMessageId : undefined,
    });

    // Avoid leaking existence across boards/conversations: treat unauthorized as not found.
    if (!scope) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if reaction already exists
    const existing = await db.reaction.findFirst({
      where: {
        profileId,
        emoji,
        ...(scope.kind === "message"
          ? { messageId: scope.messageId }
          : { directMessageId: scope.directMessageId }),
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Reaction already exists" });
    }

    // Create reaction
    const reaction = await db.reaction.create({
      data: {
        emoji,
        profileId,
        ...(scope.kind === "message"
          ? { messageId: scope.messageId }
          : { directMessageId: scope.directMessageId }),
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            avatarAsset: {
              select: uploadedAssetSelect,
            },
          },
        },
      },
    });

    // Emit socket event
    if (req.io) {
      const roomKey =
        scope.kind === "message"
          ? `channel:${scope.channelId}`
          : `conversation:${scope.conversationId}`;

      const reactionRoomKey =
        scope.kind === "message"
          ? `chat:${scope.channelId}:reactions`
          : `chat:${scope.conversationId}:reactions`;

      req.io.to(roomKey).emit(reactionRoomKey, {
        messageId:
          scope.kind === "message" ? scope.messageId : scope.directMessageId,
        reaction,
        action: "add",
      });
    }

    res.json(reaction);
  } catch (error) {
    logger.error("[REACTIONS_POST]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE /reactions/:id - Remove reaction
router.delete("/:id", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { id } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Invalid reaction ID" });
    }

    const reaction = await db.reaction.findUnique({
      where: { id },
      include: {
        message: { select: { channelId: true } },
        directMessage: { select: { conversationId: true } },
      },
    });

    if (!reaction) {
      return res.status(404).json({ error: "Reaction not found" });
    }

    if (reaction.profileId !== profileId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.reaction.delete({
      where: { id },
    });

    // Emit socket event
    if (req.io) {
      const roomKey = reaction.messageId
        ? `channel:${reaction.message?.channelId}`
        : `conversation:${reaction.directMessage?.conversationId}`;

      const reactionRoomKey = reaction.messageId
        ? `chat:${reaction.message?.channelId}:reactions`
        : `chat:${reaction.directMessage?.conversationId}:reactions`;

      req.io.to(roomKey).emit(reactionRoomKey, {
        messageId: reaction.messageId || reaction.directMessageId,
        reaction: { id, emoji: reaction.emoji, profileId: reaction.profileId },
        action: "remove",
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error("[REACTIONS_DELETE]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
