import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";

interface UnreadCountRow {
  channelId: string;
  unreadCount: bigint;
}

interface SidebarChannelStateRow {
  channelId: string;
  boardId: string;
  lastMessageSeq: number;
  lastReadSeq: number;
  unreadCount: bigint;
  hasUnreadMention: boolean;
}

/**
 * Obtiene el estado de lectura de todos los canales de un board para un usuario
 *
 * Optimizado: Una sola query SQL con LEFT JOIN en lugar de 2 queries separadas.
 * Reduce latencia y carga en la DB significativamente para boards con muchos canales.
 */
export async function getBoardUnreadCounts(profileId: string, boardId: string) {
  try {
    const results = await db.$queryRaw<UnreadCountRow[]>`
      SELECT 
        c.id as "channelId",
        GREATEST(
          c."lastMessageSeq" - COALESCE(rs."lastReadSeq", c."lastMessageSeq"),
          0
        ) as "unreadCount"
      FROM "Channel" c
      INNER JOIN "Member" m
        ON m."boardId" = c."boardId"
       AND m."profileId" = ${profileId}
      LEFT JOIN "ChannelReadState" rs 
        ON rs."channelId" = c.id 
        AND rs."profileId" = ${profileId}
      WHERE c."boardId" = ${boardId}
    `;

    // Construir el objeto de respuesta
    const unreadCounts: Record<string, number> = {};
    for (const row of results) {
      // bigint from SQL needs to be converted to number
      unreadCounts[row.channelId] = Number(row.unreadCount);
    }

    return unreadCounts;
  } catch (error) {
    logger.error("[getBoardUnreadCounts] Database error:", error);
    throw error; // Re-throw to let route handler catch it
  }
}

/**
 * Obtiene el estado de lectura de un canal específico
 */
export async function getChannelReadState(
  profileId: string,
  channelId: string,
) {
  try {
    return await db.channelReadState.findUnique({
      where: {
        profileId_channelId: {
          profileId,
          channelId,
        },
      },
    });
  } catch (error) {
    logger.error("[getChannelReadState] Database error:", error);
    throw error;
  }
}

/**
 * Marca un canal como leído (resetea el contador de no leídos)
 */
export async function markChannelAsRead(profileId: string, channelId: string) {
  try {
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { lastMessageSeq: true },
    });

    if (!channel) {
      throw new Error("CHANNEL_NOT_FOUND");
    }

    return await db.channelReadState.upsert({
      where: {
        profileId_channelId: {
          profileId,
          channelId,
        },
      },
      create: {
        profileId,
        channelId,
        lastReadAt: new Date(),
        lastReadSeq: channel.lastMessageSeq,
        unreadCount: 0,
      },
      update: {
        lastReadAt: new Date(),
        lastReadSeq: channel.lastMessageSeq,
        unreadCount: 0,
      },
    });
  } catch (error) {
    logger.error("[markChannelAsRead] Database error:", error);
    throw error;
  }
}

/**
 * Incrementa el contador de no leídos para todos los miembros de un canal
 * excepto el que envió el mensaje.
 *
 * Optimizado: Una sola query SQL en lugar de N queries individuales.
 * Esto evita el problema de connection pool exhaustion con boards grandes.
 */
interface MentionChannelRow {
  channelId: string;
}

export async function getSidebarChannelStates(profileId: string) {
  try {
    const results = await db.$queryRaw<SidebarChannelStateRow[]>`
      SELECT
        c.id as "channelId",
        c."boardId" as "boardId",
        c."lastMessageSeq" as "lastMessageSeq",
        COALESCE(rs."lastReadSeq", c."lastMessageSeq") as "lastReadSeq",
        GREATEST(
          c."lastMessageSeq" - COALESCE(rs."lastReadSeq", c."lastMessageSeq"),
          0
        ) as "unreadCount",
        EXISTS (
          SELECT 1
          FROM "Mention" mn
          INNER JOIN "Message" m ON m.id = mn."messageId"
          WHERE mn."profileId" = ${profileId}
            AND mn.read = false
            AND m."channelId" = c.id
        ) as "hasUnreadMention"
      FROM "Channel" c
      INNER JOIN "Member" board_member
        ON board_member."boardId" = c."boardId"
       AND board_member."profileId" = ${profileId}
      LEFT JOIN "ChannelReadState" rs
        ON rs."channelId" = c.id
       AND rs."profileId" = ${profileId}
      ORDER BY c."boardId" ASC, c."position" ASC
    `;

    return results.map((row) => ({
      channelId: row.channelId,
      boardId: row.boardId,
      lastMessageSeq: Number(row.lastMessageSeq),
      lastReadSeq: Number(row.lastReadSeq),
      unreadCount: Number(row.unreadCount),
      hasUnreadMention: row.hasUnreadMention === true,
    }));
  } catch (error) {
    logger.error("[getSidebarChannelStates] Database error:", error);
    throw error;
  }
}

/**
 * Obtiene los channelIds que tienen menciones no leídas para un usuario en un board
 *
 * Optimizado: Una sola query SQL con JOINs en lugar de 2 queries separadas.
 * Usa DISTINCT directamente en SQL para evitar procesamiento en JS.
 */
export async function getBoardUnreadMentions(
  profileId: string,
  boardId: string,
) {
  try {
    // Single query with JOINs - O(1) instead of O(2)
    const results = await db.$queryRaw<MentionChannelRow[]>`
      SELECT DISTINCT m."channelId"
      FROM "Mention" mn
      INNER JOIN "Message" m ON m.id = mn."messageId"
      INNER JOIN "Channel" c ON c.id = m."channelId"
      WHERE mn."profileId" = ${profileId}
        AND mn.read = false
        AND c."boardId" = ${boardId}
    `;

    return results.map((r) => r.channelId);
  } catch (error) {
    logger.error("[getBoardUnreadMentions] Database error:", error);
    throw error;
  }
}

/**
 * Marca las menciones de un canal como leídas para un usuario
 * Optimizado: Una sola query usando la relación de Prisma
 */
export async function markChannelMentionsAsRead(
  profileId: string,
  channelId: string,
) {
  try {
    // Optimizado: Prisma maneja el join internamente, evita query extra
    return await db.mention.updateMany({
      where: {
        profileId,
        read: false,
        message: {
          channelId,
        },
      },
      data: {
        read: true,
      },
    });
  } catch (error) {
    // Log but don't throw - this is secondary to marking channel as read
    logger.error("[markChannelMentionsAsRead] Database error:", error);
    return { count: 0 };
  }
}
