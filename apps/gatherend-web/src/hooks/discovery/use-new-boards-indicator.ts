"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/components/providers/socket-provider";

/**
 * Hook que se suscribe a un room de discovery para un board específico
 * y escucha eventos de creación o bump de boards públicos.
 *
 * Uso:
 * - Al entrar a la vista de discovery, llamar con el boardId del usuario
 * - El hook se suscribe al room `discovery:board:{boardId}`
 * - Cuando hay nuevos boards, `hasNewBoards` se vuelve true
 * - Al hacer refresh, llamar `clearIndicator()` para resetear
 * - Al desmontar el componente, se desuscribe automáticamente
 */
export function useNewBoardsIndicator(boardId: string | null) {
  const { socket, isConnected } = useSocket();
  const [hasNewBoards, setHasNewBoards] = useState(false);
  const subscribedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !boardId) {
      return;
    }

    const roomName = `discovery:board:${boardId}`;

    // Suscribirse al room
    socket.emit("discovery:subscribe", { boardId });
    subscribedRoomRef.current = roomName;

    // Escuchar eventos de nuevo contenido
    const handleNewBoard = (data: { boardId: string }) => {
      if (data.boardId === boardId) {
        setHasNewBoards(true);
      }
    };

    const handleBoardBump = (data: { boardId: string }) => {
      if (data.boardId === boardId) {
        setHasNewBoards(true);
      }
    };

    socket.on("discovery:board-created", handleNewBoard);
    socket.on("discovery:board-bumped", handleBoardBump);

    // Cleanup: desuscribirse al desmontar o cambiar de board
    return () => {
      socket.off("discovery:board-created", handleNewBoard);
      socket.off("discovery:board-bumped", handleBoardBump);

      if (subscribedRoomRef.current) {
        socket.emit("discovery:unsubscribe", { boardId });
        subscribedRoomRef.current = null;
      }
    };
  }, [socket, isConnected, boardId]);

  // Resetear indicador cuando el usuario hace refresh
  const clearIndicator = useCallback(() => {
    setHasNewBoards(false);
  }, []);

  return {
    hasNewBoards,
    clearIndicator,
  };
}
