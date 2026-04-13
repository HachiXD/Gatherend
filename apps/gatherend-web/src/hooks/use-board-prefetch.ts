"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BoardWithData } from "@/components/providers/board-provider";
import {
  BOARD_CACHE_GC_TIME_MS,
  BOARD_CACHE_STALE_TIME_MS,
  boardQueryKey,
} from "@/hooks/board-cache";

/**
 * Hook para prefetch de datos del board usando TanStack Query
 * Se usa en NavigationItem para pre-cargar datos cuando el usuario hace hover
 *
 * Esto permite que cuando el usuario navegue al board, los datos ya estén
 * en el cache de React Query y el BoardProvider los hidrate inmediatamente.
 *
 * La autenticación se maneja automáticamente por cookies de sesión.
 */
export function useBoardPrefetch() {
  const queryClient = useQueryClient();

  const prefetchBoard = useCallback(
    async (boardId: string) => {
      // Verificar si ya tenemos los datos en cache y no están stale
      const existingData = queryClient.getQueryData<BoardWithData>(
        boardQueryKey(boardId),
      );

      // Si ya tenemos datos frescos, no hacer prefetch
      const queryState = queryClient.getQueryState(boardQueryKey(boardId));
      const isFresh =
        queryState?.dataUpdatedAt &&
        Date.now() - queryState.dataUpdatedAt < BOARD_CACHE_STALE_TIME_MS;

      if (existingData && isFresh) {
        return;
      }

      // Prefetch los datos del board (usa cookies de sesión automáticamente)
      await queryClient.prefetchQuery({
        queryKey: boardQueryKey(boardId),
        queryFn: async (): Promise<BoardWithData> => {
          const response = await fetch(`/api/boards/${boardId}`, {
            credentials: "include", // Incluir cookies de autenticación
          });

          if (!response.ok) {
            throw new Error("Failed to fetch board");
          }

          return response.json();
        },
        staleTime: BOARD_CACHE_STALE_TIME_MS,
        gcTime: BOARD_CACHE_GC_TIME_MS,
      });
    },
    [queryClient]
  );

  /**
   * Obtiene los datos del board desde el cache si existen
   */
  const getBoardFromCache = useCallback(
    (boardId: string): BoardWithData | undefined => {
      return queryClient.getQueryData<BoardWithData>(boardQueryKey(boardId));
    },
    [queryClient]
  );

  /**
   * Verifica si el board tiene datos frescos en cache
   */
  const hasFreshBoardData = useCallback(
    (boardId: string): boolean => {
      const queryState = queryClient.getQueryState(boardQueryKey(boardId));
      const isFresh =
        queryState?.dataUpdatedAt &&
        Date.now() - queryState.dataUpdatedAt < BOARD_CACHE_STALE_TIME_MS;
      return !!isFresh;
    },
    [queryClient]
  );

  return { prefetchBoard, getBoardFromCache, hasFreshBoardData };
}
