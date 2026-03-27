import { useSocketClient } from "@/components/providers/socket-provider";
import { acquireBoardRoom, releaseBoardRoom, rejoinBoardRooms } from "@/hooks/board-room-subscriptions";
import { useEffect, useMemo, useRef } from "react";
import { useUnreadStore } from "./use-unread-store";
import { useQueryClient } from "@tanstack/react-query";
import {
  FormattedConversation,
  conversationsQueryKey,
} from "./use-conversations";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { useChatRoomLifecycleStore } from "./use-chat-room-lifecycle-store";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
} from "@/types/uploaded-assets";

interface UseGlobalUnreadSocketProps {
  currentProfileId: string;
  boardIds: string[]; // IDs de todos los boards del usuario
}

// Tipos para payloads de socket
type ProfileInfo = ClientProfileSummary;

interface ChannelMessagePayload {
  channelId: string;
  messageTimestamp?: number; // timestamp del mensaje para comparar con lastAck
  messageSender?: ProfileInfo | null;
  member?: {
    profile?: ProfileInfo;
  };
}

interface DirectMessagePayload {
  conversationId: string;
  messageTimestamp?: number; // timestamp del mensaje para comparar con lastAck
  sender?: ProfileInfo;
  lastMessage?: {
    content: string;
    attachmentAsset?: ClientAttachmentAsset | null;
    hasAttachment?: boolean;
    stickerName?: string | null;
    deleted: boolean;
    senderId: string;
  };
}

/**
 * Hook global que escucha mensajes en todos los boards del usuario
 * y marca como unread los canales donde lleguen mensajes.
 *
 * Usa el store centralizado (viewingRoom, lastAck) para evitar race conditions
 * durante la navegación SPA.
 */
export const useGlobalUnreadSocket = ({
  currentProfileId,
  boardIds,
}: UseGlobalUnreadSocketProps) => {
  const { socket } = useSocketClient();
  const { addUnread, addDmUnread, viewingRoom, lastAck } = useUnreadStore();
  const queryClient = useQueryClient();

  // Debounce invalidateQueries per room to avoid repeated work during bursts
  const invalidateTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  // Stabilize board list to avoid effect churn when parent recreates array references.
  const stableBoardIds = useMemo(
    () => [...new Set(boardIds)].sort().join(","),
    [boardIds],
  );
  const boardIdList = useMemo(
    () => stableBoardIds.split(",").filter(Boolean),
    [stableBoardIds],
  );

  // Usar ref para tener acceso al valor más reciente sin re-suscribir listeners
  const viewingRoomRef = useRef(viewingRoom);
  const lastAckRef = useRef(lastAck);

  // Mantener refs actualizados
  useEffect(() => {
    viewingRoomRef.current = viewingRoom;
  }, [viewingRoom]);

  useEffect(() => {
    lastAckRef.current = lastAck;
  }, [lastAck]);

  useEffect(() => {
    if (!socket || boardIdList.length === 0) return;

    const timers = invalidateTimersRef.current;

    // Schedule a lightweight invalidate for a room (deduped within a small window)
    const scheduleChatInvalidate = (
      roomType: "channel" | "conversation",
      roomId: string,
    ) => {
      const key = `${roomType}:${roomId}`;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        timers.delete(key);
        queryClient.invalidateQueries({
          queryKey: ["chat", roomType, roomId],
          refetchType: "none",
        });
      }, 250);

      timers.set(key, timeout);
    };


    // Handler para mensajes de canales
    const handleChannelMessage = (payload: ChannelMessagePayload) => {
      const { channelId, member, messageTimestamp } = payload;
      const messageSender = payload.messageSender ?? member?.profile ?? null;
      const isOwnMessage = messageSender?.id === currentProfileId;

      // Usar ref para obtener el valor más actualizado (evita stale closure)
      const currentViewingRoom = viewingRoomRef.current;
      const currentLastAck = lastAckRef.current[channelId] || 0;
      const msgTime = messageTimestamp || Date.now();

      const isViewingThisRoom = currentViewingRoom === channelId;
      const isAfterLastAck = msgTime > currentLastAck;
      const isTrackedChannel = useChatRoomLifecycleStore
        .getState()
        .isTracked("channel", channelId);


      // Solo marcar como unread si:
      // 1. NO es tu mensaje
      // 2. NO estás viendo ese canal
      // 3. El mensaje es posterior al último ack
      if (!isOwnMessage && !isViewingThisRoom && isAfterLastAck) {
        // For subscribed/cached channels, unread counting is handled by
        // useGlobalChannelListeners (channel-scoped event). This avoids
        // double increments when both channel and global board events arrive.
        if (isTrackedChannel) {
          scheduleChatInvalidate("channel", channelId);
          return;
        }

        addUnread(channelId, msgTime);

        // Marcar el chat query como stale sin refetch inmediato (debounced).
        // Esto evita trabajo repetido en bursts de mensajes.
        scheduleChatInvalidate("channel", channelId);

        // If this channel was previously opened and its message window is still in memory,
        // mark it as needing catch-up when it's not currently subscribed to the heavy stream.
        const isHeavySubscribed = useChatRoomLifecycleStore
          .getState()
          .isTracked("channel", channelId);
        if (!isHeavySubscribed) {
          chatMessageWindowStore.markNeedsCatchUpIfExists(
            `chatWindow:channel:${channelId}`,
          );
        }
      }

      // Fallback de consistencia:
      // Si estoy viendo este canal y llega el evento global, invalidar la query
      // activa para cubrir desincronizaciones de room membership.
      if (!isOwnMessage && isViewingThisRoom) {
        void queryClient.invalidateQueries({
          queryKey: ["chat", "channel", channelId],
          refetchType: "active",
        });
      }
    };

    // Handler para mensajes directos
    const handleDirectMessage = (payload: DirectMessagePayload) => {
      const { conversationId, sender, lastMessage, messageTimestamp } = payload;
      const isOwnMessage = sender?.id === currentProfileId;

      // Usar ref para obtener el valor más actualizado
      const currentViewingRoom = viewingRoomRef.current;
      const currentLastAck = lastAckRef.current[conversationId] || 0;
      const msgTime = messageTimestamp || Date.now();

      const isViewingThisRoom = currentViewingRoom === conversationId;
      const isAfterLastAck = msgTime > currentLastAck;

      // Solo marcar como unread si cumple las condiciones
      if (!isOwnMessage && !isViewingThisRoom && isAfterLastAck) {
        addDmUnread(conversationId, msgTime);

        scheduleChatInvalidate("conversation", conversationId);

        // If this conversation was previously opened and its message window is still in memory,
        // mark it as needing catch-up. The heavy stream may be unsubscribed while the user is away.
        const isHeavySubscribed = useChatRoomLifecycleStore
          .getState()
          .isTracked("conversation", conversationId);
        if (!isHeavySubscribed) {
          chatMessageWindowStore.markNeedsCatchUpIfExists(
            `chatWindow:conversation:${conversationId}`,
          );
        }
      }

      // Actualizar el cache de conversaciones
      if (lastMessage) {
        queryClient.setQueryData<FormattedConversation[]>(
          conversationsQueryKey,
          (oldConversations) => {
            if (!oldConversations) return oldConversations;

            // Buscar si la conversación ya existe en el cache
            const existingConvIndex = oldConversations.findIndex(
            (conv) => conv.id === conversationId,
          );

            if (existingConvIndex >= 0) {
              // La conversación existe, actualizar lastMessage y moverla al tope
              const updatedConv: FormattedConversation = {
                ...oldConversations[existingConvIndex],
                lastMessage: {
                  ...lastMessage,
                  hasAttachment:
                    lastMessage.hasAttachment ??
                    Boolean(lastMessage.attachmentAsset),
                },
                updatedAt: new Date(),
              };

              // Remover de su posición actual y añadir al inicio
              const filtered = oldConversations.filter(
              (conv) => conv.id !== conversationId,
            );
              return [updatedConv, ...filtered];
            } else {
              // La conversación no existe en el cache - invalidar para obtener datos frescos
              // Esto ocurre cuando alguien te escribe por primera vez
              queryClient.invalidateQueries({
                queryKey: conversationsQueryKey,
              });
              return oldConversations;
            }
          }
        );
      }
    };

    // Rejoin all board rooms on every connect/reconnect.
    const joinAllBoards = () => {
      boardIdList.forEach((boardId) => {
        acquireBoardRoom(socket, boardId);
      });
    };

    if (socket.connected) {
      joinAllBoards();
    }

    const handleConnect = () => {
      rejoinBoardRooms(socket);
    };

    // Escuchar eventos de nuevos mensajes en todos los boards
    socket.on("connect", handleConnect);
    socket.on("global:channel:message", handleChannelMessage);
    socket.on("global:conversation:message", handleDirectMessage);

    return () => {

      // Clear any pending invalidation timers
      timers.forEach((t) => clearTimeout(t));
      timers.clear();

      // Limpiar listeners
      socket.off("connect", handleConnect);
      socket.off("global:channel:message", handleChannelMessage);
      socket.off("global:conversation:message", handleDirectMessage);

      // Salir de los boards
      boardIdList.forEach((boardId) => {
        releaseBoardRoom(socket, boardId);
      });
    };
  }, [socket, currentProfileId, boardIdList, addUnread, queryClient]);
};

