"use client";

import { useGlobalChannelListeners } from "@/hooks/use-global-channel-listeners";
import { useGlobalConversationListeners } from "@/hooks/use-global-conversation-listeners";
import { useChatRoomSubscriptionSync } from "@/hooks/use-chat-room-subscription-sync";

/**
 * ChatCacheProvider - Mantiene el cache de chat actualizado via socket.
 *
 * Responsabilidades:
 * - Conectar listeners por room segun el lifecycle manager
 * - Centralizar join/leave y reconnect para channels y conversations
 */

interface ChatCacheProviderProps {
  currentProfileId: string;
  children: React.ReactNode;
}

export function ChatCacheProvider({
  currentProfileId,
  children,
}: ChatCacheProviderProps) {
  // Registrar primero los listeners scoped, luego el sync de membership para
  // que los socket.on ya esten montados antes de emitir join.
  useGlobalChannelListeners({ currentProfileId });
  useGlobalConversationListeners({ currentProfileId });

  // El lifecycle real de las suscripciones vive fuera de React Query.
  useChatRoomSubscriptionSync();

  return <>{children}</>;
}
