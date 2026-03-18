import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";

interface MarkReadResult {
  success: boolean;
  error?: "NOT_FOUND" | "NOT_PARTICIPANT" | "DB_ERROR";
}

/**
 * Marca una conversación como leída para un perfil específico.
 * Actualiza el campo lastReadByOneAt o lastReadByTwoAt según corresponda.
 * Returns a result object instead of throwing errors.
 */
export async function markConversationAsRead(
  profileId: string,
  conversationId: string
): Promise<MarkReadResult> {
  try {
    // Primero obtener la conversación para saber qué campo actualizar
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { profileOneId: true, profileTwoId: true, updatedAt: true },
    });

    if (!conversation) {
      return { success: false, error: "NOT_FOUND" };
    }

    // Determinar qué campo actualizar según el perfil
    const isProfileOne = conversation.profileOneId === profileId;
    const isProfileTwo = conversation.profileTwoId === profileId;

    if (!isProfileOne && !isProfileTwo) {
      return { success: false, error: "NOT_PARTICIPANT" };
    }

    const updateData = isProfileOne
      ? {
          lastReadByOneAt: new Date(),
          // Preserve ordering metadata: opening a DM should not bump it.
          updatedAt: conversation.updatedAt,
        }
      : {
          lastReadByTwoAt: new Date(),
          // Preserve ordering metadata: opening a DM should not bump it.
          updatedAt: conversation.updatedAt,
        };

    await db.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return { success: true };
  } catch (error) {
    logger.error("[markConversationAsRead] Database error:", error);
    return { success: false, error: "DB_ERROR" };
  }
}

/**
 * Obtiene las conversaciones con mensajes no leídos para un perfil.
 * Compara lastReadAt con el último mensaje de cada conversación.
 * 
 * OPTIMIZADO: Usa una sola query con subquery para evitar N+1
 */
export async function getUnreadConversations(profileId: string) {
  try {
    // Optimized: Single query with raw SQL to avoid N+1
    const results = await db.$queryRaw<Array<{ conversationId: string; unreadCount: bigint }>>`
      WITH user_conversations AS (
        SELECT 
          c.id,
          c."profileOneId",
          c."profileTwoId",
          CASE 
            WHEN c."profileOneId" = ${profileId} THEN c."lastReadByOneAt"
            ELSE c."lastReadByTwoAt"
          END as "lastReadAt"
        FROM "Conversation" c
        WHERE (
          (c."profileOneId" = ${profileId} AND c."hiddenByOneAt" IS NULL)
          OR 
          (c."profileTwoId" = ${profileId} AND c."hiddenByTwoAt" IS NULL)
        )
      )
      SELECT 
        uc.id as "conversationId",
        COUNT(dm.id) as "unreadCount"
      FROM user_conversations uc
      LEFT JOIN "DirectMessage" dm ON dm."conversationId" = uc.id
        AND dm."senderId" != ${profileId}
        AND (uc."lastReadAt" IS NULL OR dm."createdAt" > uc."lastReadAt")
      GROUP BY uc.id
    `;

    const unreadCounts: Record<string, number> = {};
    for (const row of results) {
      unreadCounts[row.conversationId] = Number(row.unreadCount);
    }

    return unreadCounts;
  } catch (error) {
    logger.error("[getUnreadConversations] Database error:", error);
    return {}; // Return empty object on error to not break the UI
  }
}

/**
 * Obtiene el timestamp de última lectura para una conversación específica.
 */
export async function getConversationLastRead(
  profileId: string,
  conversationId: string
): Promise<Date | null> {
  try {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        profileOneId: true,
        lastReadByOneAt: true,
        lastReadByTwoAt: true,
      },
    });

    if (!conversation) {
      return null;
    }

    const isProfileOne = conversation.profileOneId === profileId;
    return isProfileOne
      ? conversation.lastReadByOneAt
      : conversation.lastReadByTwoAt;
  } catch (error) {
    logger.error("[getConversationLastRead] Database error:", error);
    return null;
  }
}
