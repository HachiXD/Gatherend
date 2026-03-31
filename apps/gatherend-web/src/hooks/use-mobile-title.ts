"use client";

import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { useCurrentBoardData } from "@/hooks/use-board-data";
import { useMemo } from "react";

/**
 * Hook para obtener el título actual para el header móvil
 * Retorna el nombre del canal o conversación activa
 */
export function useMobileTitle(): string | undefined {
  const context = useBoardSwitchSafe();
  const { data: board } = useCurrentBoardData();

  return useMemo(() => {
    if (!context) return undefined;

    // Si estamos en discovery, no mostrar título
    if (context.isDiscovery) return undefined;

    // Si hay una conversación activa
    if (context.currentConversationId && board) {
      // Buscar el nombre del otro usuario en la conversación
      // Por ahora solo mostrar "Direct Message"
      return "Direct Message";
    }

    // Si hay un canal activo
    if (context.currentChannelId && board) {
      const channel = board.channels.find(
        (ch) => ch.id === context.currentChannelId
      );
      if (channel) return `/ ${channel.name}`;
    }

    // Fallback al nombre del board
    if (board) return board.name;

    return undefined;
  }, [context, board]);
}
