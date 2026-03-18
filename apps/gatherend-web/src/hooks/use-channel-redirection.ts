"use client";

import { useEffect, useRef } from "react";
import { ChannelType } from "@prisma/client";
import {
  useBoardSwitchNavigation,
  useBoardSwitchRouting,
  getLastChannelForBoard,
} from "@/contexts/board-switch-context";
import { useCurrentBoardData } from "@/hooks/use-board-data";
import type { BoardWithData } from "@/components/providers/board-provider";

/**
 * Selecciona el canal objetivo para redirección basado en prioridades:
 * 1. Último canal visitado (desde localStorage)
 * 2. Canal MAIN si existe
 * 3. Primer canal por posición
 *
 * @param board - Board data
 * @param lastChannelId - Último canal visitado
 * @returns ID del canal objetivo o null
 */
function selectTargetChannel(
  board: BoardWithData,
  lastChannelId: string | null,
): string | null {
  const allChannels = [
    ...board.channels,
    ...board.categories.flatMap((cat) => cat.channels),
  ];

  if (allChannels.length === 0) return null;

  // Prioridad 1: Último canal visitado
  if (lastChannelId) {
    const found = allChannels.find((c) => c.id === lastChannelId);
    if (found) return found.id;
  }

  // Prioridad 2: Canal MAIN
  const mainChannel = allChannels.find((c) => c.type === ChannelType.MAIN);
  if (mainChannel) return mainChannel.id;

  // Prioridad 3: Primer canal por posición
  const sortedChannels = [...allChannels].sort(
    (a, b) => a.position - b.position,
  );
  return sortedChannels[0]?.id ?? null;
}

interface UseChannelRedirectionResult {
  /** True if currently redirecting to a channel */
  isRedirecting: boolean;
}

/**
 * Hook para manejar la redirección automática al canal apropiado.
 *
 * Este hook encapsula la lógica de redirección que antes estaba en BoardView,
 * separando concerns y mejorando testabilidad.
 *
 * Prioridad de redirección:
 * 1. Último channel visitado (desde localStorage) si aún existe
 * 2. Canal MAIN si existe
 * 3. Primer canal por posición
 */
export function useChannelRedirection(): UseChannelRedirectionResult {
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
  } = useBoardSwitchRouting();

  const { switchChannel, isClientNavigationEnabled } =
    useBoardSwitchNavigation();

  const { data: board, isLoading } = useCurrentBoardData();

  // Ref para trackear boards para los que ya intentamos redirect
  const redirectAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guardián temprano: navegación cliente no habilitada
    if (!isClientNavigationEnabled) return;

    // Guardián temprano: datos aún cargando o board incorrecto
    if (isLoading || !board || board.id !== currentBoardId) return;

    // Guardián temprano: ya hay una vista activa
    if (currentChannelId || currentConversationId || isDiscovery) return;

    // Guardián temprano: ya intentamos redirect para este board
    if (redirectAttemptedRef.current === currentBoardId) return;

    // Reset ref si el board cambió
    if (redirectAttemptedRef.current !== currentBoardId) {
      redirectAttemptedRef.current = null;
    }

    // Obtener canal objetivo
    const lastChannelId = getLastChannelForBoard(currentBoardId);
    const targetChannelId = selectTargetChannel(board, lastChannelId);

    if (targetChannelId) {
      // Marcar que ya intentamos redirect para este board
      redirectAttemptedRef.current = currentBoardId;
      // Ejecutar redirección
      switchChannel(targetChannelId);
    }
  }, [
    board,
    isLoading,
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isClientNavigationEnabled,
    switchChannel,
  ]);

  // Determinar si estamos en proceso de redirección
  const isRedirecting =
    !currentChannelId && !currentConversationId && !isDiscovery;

  return { isRedirecting };
}
