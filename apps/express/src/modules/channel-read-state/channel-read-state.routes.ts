import { Router } from "express";
import {
  getSidebarChannelStates,
  getBoardUnreadCounts,
  markChannelAsRead,
  getBoardUnreadMentions,
  markChannelMentionsAsRead,
} from "./channel-read-state.service.js";
import {
  verifyMemberInBoardCached,
  getChannelByIdCached,
} from "../../lib/cache.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/channel-read-state/sidebar
 * Obtiene el estado agregado de sidebar para todos los canales accesibles.
 */
router.get("/sidebar", async (req, res) => {
  try {
    const profileId = req.profile?.id;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const channels = await getSidebarChannelStates(profileId);

    return res.json({ channels });
  } catch (error) {
    logger.error("[CHANNEL_READ_STATE_GET_SIDEBAR]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

/**
 * GET /api/channel-read-state/board/:boardId
 * Obtiene el estado de lectura de todos los canales de un board
 */
router.get("/board/:boardId", async (req, res) => {
  try {
    // Use req.profile from authenticateRequest middleware
    const profileId = req.profile?.id;
    const { boardId } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return res.status(400).json({ error: "Invalid board ID" });
    }

    // Verificar que el usuario es miembro del board (CACHED)
    const board = await verifyMemberInBoardCached(profileId, boardId);
    if (!board) {
      return res.status(403).json({ error: "Not a member of this board" });
    }

    const unreadCounts = await getBoardUnreadCounts(profileId, boardId);

    return res.json(unreadCounts);
  } catch (error) {
    logger.error("[CHANNEL_READ_STATE_GET_BOARD]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

/**
 * POST /api/channel-read-state/:channelId/read
 * Marca un canal como leído
 */
router.post("/:channelId/read", async (req, res) => {
  try {
    // Use req.profile from authenticateRequest middleware
    const profileId = req.profile?.id;
    const { channelId } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!channelId || !UUID_REGEX.test(channelId)) {
      return res.status(400).json({ error: "Invalid channel ID" });
    }

    // Verificar que el canal existe (CACHED)
    const channel = await getChannelByIdCached(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Verificar que el usuario es miembro del board (CACHED)
    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) {
      return res.status(403).json({ error: "Not a member of this board" });
    }

    const readState = await markChannelAsRead(profileId, channelId);

    // También marcar las menciones del canal como leídas
    await markChannelMentionsAsRead(profileId, channelId);

    return res.json(readState);
  } catch (error) {
    logger.error("[CHANNEL_READ_STATE_MARK_READ]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

/**
 * GET /api/channel-read-state/board/:boardId/mentions
 * Obtiene los canales con menciones no leídas en un board
 */
router.get("/board/:boardId/mentions", async (req, res) => {
  try {
    // Use req.profile from authenticateRequest middleware
    const profileId = req.profile?.id;
    const { boardId } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return res.status(400).json({ error: "Invalid board ID" });
    }

    // Verificar que el usuario es miembro del board (CACHED)
    const board = await verifyMemberInBoardCached(profileId, boardId);
    if (!board) {
      return res.status(403).json({ error: "Not a member of this board" });
    }

    const channelsWithMentions = await getBoardUnreadMentions(
      profileId,
      boardId,
    );

    return res.json(channelsWithMentions);
  } catch (error) {
    logger.error("[CHANNEL_READ_STATE_GET_MENTIONS]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
