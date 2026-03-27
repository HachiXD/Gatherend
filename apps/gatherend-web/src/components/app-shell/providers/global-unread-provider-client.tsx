"use client";

import { useGlobalUnreadSocket } from "@/hooks/use-global-unread-socket";
import { useCachedBoardBansSync } from "@/hooks/use-cached-board-bans-sync";
import { useCachedBoardSync } from "@/hooks/use-cached-board-sync";
import { useChannelReadState } from "@/hooks/use-channel-read-state";
import { useFriendRequestSocket } from "@/hooks/use-friend-request-socket";
import { useNewConversationSocket } from "@/hooks/use-new-conversation-socket";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { useTabNotifications } from "@/hooks/use-tab-notifications";

/**
 * GlobalUnreadProvider - Solo inicializa sockets y carga estado inicial
 *
 * REFACTORIZADO: Eliminado el Context para evitar re-renders en cascada.
 * Ahora solo inicializa:
 * - useGlobalUnreadSocket: escucha mensajes nuevos para marcar unreads
 * - useChannelReadState: carga estado inicial de unreads desde servidor
 * - useFriendRequestSocket: escucha friend requests en tiempo real
 * - useNewConversationSocket: escucha nuevas conversaciones
 *
 * El mantenimiento del caché de canales se movió a ChatCacheProvider.
 * El auto-marking de rooms se movió a useAutoMarkAsRead hook,
 * que se usa directamente en ChannelView y ConversationView.
 */

interface GlobalUnreadProviderProps {
  currentProfileId: string;
  boardIds: string[];
  children: React.ReactNode;
}

export const GlobalUnreadProvider = ({
  currentProfileId,
  boardIds,
  children,
}: GlobalUnreadProviderProps) => {
  useCachedBoardSync();
  useCachedBoardBansSync();

  // Escuchar mensajes nuevos en todos los boards
  useGlobalUnreadSocket({
    currentProfileId,
    boardIds,
  });

  // Cargar estado inicial de unreads desde servidor
  useChannelReadState(currentProfileId, boardIds);

  // Escuchar menciones en tiempo real
  useMentionNotifications({
    profileId: currentProfileId,
  });

  // Escuchar friend requests en tiempo real
  useFriendRequestSocket({
    profileId: currentProfileId,
  });

  // Escuchar nuevas conversaciones (cuando se acepta amistad)
  useNewConversationSocket({
    profileId: currentProfileId,
  });

  useTabNotifications();

  // No Context needed - just initialize sockets and render children
  return <>{children}</>;
};
