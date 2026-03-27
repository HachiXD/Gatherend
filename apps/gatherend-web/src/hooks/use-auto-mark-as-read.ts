"use client";

import { useEffect, useCallback, useRef } from "react";
import { useUnreadStore, addPendingRead, removePendingRead } from "./use-unread-store";
import { useMentionStore } from "./use-mention-store";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

/**
 * Hook para auto-marcar un canal/conversación como leído cuando el usuario lo visita.
 *
 * OPTIMIZACIÓN: Este hook reemplaza la lógica que estaba en GlobalUnreadProvider.
 * Al moverla a las vistas (ChannelView, ConversationView), eliminamos la necesidad
 * de que el Provider se suscriba a cambios de navegación.
 *
 * @param roomId - ID del canal o conversación actual
 * @param isConversation - true si es una conversación (DM), false si es un canal
 */
export function useAutoMarkAsRead(
  roomId: string | null | undefined,
  isConversation: boolean = false,
) {
  const profile = useProfile();
  const getToken = useTokenGetter();
  const clearUnread = useUnreadStore((state) => state.clearUnread);
  const clearDmUnread = useUnreadStore((state) => state.clearDmUnread);
  const setViewingRoom = useUnreadStore((state) => state.setViewingRoom);
  const setLastAck = useUnreadStore((state) => state.setLastAck);
  const clearMention = useMentionStore((state) => state.clearMention);

  // Ref para trackear el room anterior (para limpiar viewingRoom al salir)
  const previousRoomRef = useRef<string | null>(null);

  // Función para marcar como leído (llamada al servidor)
  const markAsReadOnServer = useCallback(
    async (roomIdToMark: string, isConv: boolean) => {
      if (!profile?.id) return;

      addPendingRead(roomIdToMark);
      try {
        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

        const token = await getToken();
        const authHeaders = getExpressAuthHeaders(profile.id, token);

        const endpoint = isConv
          ? `${socketUrl}/conversation-read-state/${roomIdToMark}/read`
          : `${socketUrl}/channel-read-state/${roomIdToMark}/read`;

        await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
        });

      } catch (error) {
        console.error("[auto-mark-as-read] Error marking as read:", error);
      } finally {
        removePendingRead(roomIdToMark);
      }
    },
    [profile?.id, getToken],
  );

  // Efecto principal: marcar como leído al entrar, limpiar al salir
  useEffect(() => {
    if (!roomId) {
      // Si no hay roomId y teníamos uno antes, limpiar viewingRoom
      if (previousRoomRef.current) {
        setViewingRoom(null);
        previousRoomRef.current = null;
      }
      return;
    }

    // Establecer que estamos viendo este room
    setViewingRoom(roomId);

    if (isConversation) {
      clearDmUnread(roomId);
    } else {
      clearUnread(roomId);
    }
    clearMention(roomId);

    // Actualizar lastAck para evitar race conditions con mensajes entrantes
    setLastAck(roomId);

    // Marcar en el servidor (async, no bloqueante)
    markAsReadOnServer(roomId, isConversation);

    // Guardar referencia del room actual
    previousRoomRef.current = roomId;

    // Cleanup al desmontar o cambiar de room
    return () => {
      setViewingRoom(null);
    };
  }, [
    roomId,
    isConversation,
    clearUnread,
    clearDmUnread,
    clearMention,
    setViewingRoom,
    setLastAck,
    markAsReadOnServer,
  ]);
}
