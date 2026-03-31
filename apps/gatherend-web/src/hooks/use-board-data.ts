import {
  useQuery,
  useQueryClient,
  useMutation,
  keepPreviousData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import axios from "axios";
import type {
  BoardWithData,
  BoardChannel,
} from "@/components/providers/board-provider";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { syncUserBoardFromBoardData } from "@/hooks/use-user-boards";

/**
 * Hook para obtener datos del board desde React Query cache
 * Los datos son hidratados por BoardProvider desde el server
 *
 * @param boardId - ID del board a obtener
 * @param options - Opciones adicionales
 * @param options.enableFetch - Si es true, hará fetch si no hay datos en cache (default: false para compatibilidad)
 */
export function useBoardData(
  boardId: string,
  options?: { enableFetch?: boolean },
) {
  const { enableFetch = false } = options || {};
  const queryClient = useQueryClient();

  return useQuery<BoardWithData>({
    queryKey: ["board", boardId],
    queryFn: async (): Promise<BoardWithData> => {
      // Hacer fetch solo si enableFetch está habilitado
      const response = await fetch(`/api/boards/${boardId}`, {
        credentials: "include", // Incluir cookies de autenticación
      });

      if (!response.ok) {
        throw new Error("Failed to fetch board");
      }

      const board = (await response.json()) as BoardWithData;
      syncUserBoardFromBoardData(queryClient, board);
      return board;
    },
    // Habilitar query solo si enableFetch es true
    enabled: enableFetch,
    // Mantener datos por 5 minutos antes de considerarlos stale
    staleTime: 1000 * 60 * 5,
    // Mantener datos anteriores mientras carga nuevos
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook para obtener datos del board actual basado en BoardSwitchContext
 * Automáticamente hace fetch si no hay datos en cache
 *
 * Este hook es ideal para componentes que necesitan reaccionar
 * a cambios de board sin re-montarse
 */
export function useCurrentBoardData() {
  // Solo suscribirse al boardId; evita re-renders cuando cambian channel/conversation/discovery.
  const boardId = useBoardNavigationStore((state) => state.currentBoardId);
  const queryClient = useQueryClient();

  return useQuery<BoardWithData>({
    queryKey: ["board", boardId],
    queryFn: async (): Promise<BoardWithData> => {
      const response = await fetch(`/api/boards/${boardId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch board");
      }

      const board = (await response.json()) as BoardWithData;
      syncUserBoardFromBoardData(queryClient, board);
      return board;
    },
    // Solo habilitar si tenemos un boardId válido
    enabled: !!boardId,
    staleTime: 1000 * 60 * 5, // 5 minutos
    // Mantener datos del board anterior mientras carga el nuevo
    // Esto evita skeletons durante transiciones entre boards
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook para obtener un canal específico desde React Query cache
 * Se actualiza automáticamente cuando el cache del board cambia
 * Útil para componentes que necesitan reaccionar a cambios de nombre/tipo del canal
 */
export function useChannelData(boardId: string, channelId: string) {
  const { data: board } = useBoardData(boardId);

  const channel = useMemo(() => {
    if (!board) return null;

    return board.channels.find((ch) => ch.id === channelId) ?? null;
  }, [board, channelId]);

  return { channel, board };
}

/**
 * Hook con funciones para mutar el cache del board localmente
 * Esto evita router.refresh() y re-renders innecesarios
 */
export function useBoardMutations(boardId: string) {
  const queryClient = useQueryClient();

  // Helper para obtener el board actual del cache
  const getBoard = useCallback(() => {
    return queryClient.getQueryData<BoardWithData>(["board", boardId]);
  }, [queryClient, boardId]);

  //  CHANNELS

  const addChannel = useCallback(
    (channel: BoardChannel) => {
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        return {
          ...old,
          channels: [...old.channels, channel],
        };
      });
    },
    [queryClient, boardId],
  );

  const updateChannel = useCallback(
    (channelId: string, updates: Partial<BoardChannel>) => {
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        return {
          ...old,
          // Actualizar en root channels
          channels: old.channels.map((ch) =>
            ch.id === channelId ? { ...ch, ...updates } : ch,
          ),
        };
      });
    },
    [queryClient, boardId],
  );

  const removeChannel = useCallback(
    (channelId: string) => {
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        return {
          ...old,
          channels: old.channels.filter((ch) => ch.id !== channelId),
        };
      });
    },
    [queryClient, boardId],
  );

  //  BOARD

  const updateBoard = useCallback(
    (updates: Partial<BoardWithData>) => {
      // Actualizar el cache del board específico
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      // Si se actualizó el nombre o imagen, también actualizar el cache de user-boards
      // para que la sidebar de navegación se actualice inmediatamente
      if (updates.name !== undefined || updates.imageAsset !== undefined) {
        queryClient.setQueryData<
          {
            id: string;
            name: string;
            imageAsset: BoardWithData["imageAsset"];
            channels: { id: string }[];
          }[]
        >(["user-boards"], (old) => {
          if (!old) return old;
          return old.map((board) =>
            board.id === boardId
              ? {
                  ...board,
                  ...(updates.name !== undefined && { name: updates.name }),
                  ...(updates.imageAsset !== undefined && {
                    imageAsset: updates.imageAsset,
                  }),
                }
              : board,
          );
        });
      }
    },
    [queryClient, boardId],
  );

  //  MEMBERS

  const updateMember = useCallback(
    (memberId: string, updates: Partial<BoardWithData["members"][0]>) => {
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.id === memberId ? { ...m, ...updates } : m,
          ),
        };
      });
    },
    [queryClient, boardId],
  );

  const removeMember = useCallback(
    (memberId: string) => {
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.filter((m) => m.id !== memberId),
        };
      });
    },
    [queryClient, boardId],
  );

  //  INVALIDATE (forzar refetch)

  const invalidateBoard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  }, [queryClient, boardId]);

  return {
    getBoard,
    // Channels
    addChannel,
    updateChannel,
    removeChannel,
    // Board
    updateBoard,
    // Members
    updateMember,
    removeMember,
    // Utils
    invalidateBoard,
  };
}

//  MUTATIONS CON OPTIMISTIC UPDATES

interface DeleteChannelVariables {
  channelId: string;
  boardId: string;
}

/**
 * Hook para eliminar un canal con optimistic update
 *
 * Beneficios sobre el approach anterior:
 * - Actualización instantánea del UI (optimistic)
 * - Rollback automático si la API falla
 * - Estados loading/error integrados
 * - Sin necesidad de manejar try/catch manualmente
 */
export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, boardId }: DeleteChannelVariables) => {
      await axios.delete(`/api/boards/${boardId}/channels/${channelId}`);
      return { channelId, boardId };
    },

    // Optimistic update: actualiza el cache ANTES de que la API responda
    onMutate: async ({ channelId, boardId }) => {
      // Cancelar queries en progreso para evitar overwrites
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      // Snapshot del estado anterior (para rollback)
      const previousBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        boardId,
      ]);

      // Actualización optimista
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          channels: old.channels.filter((ch) => ch.id !== channelId),
        };
      });

      // Retornar context para rollback
      return { previousBoard, boardId };
    },

    // Rollback si la API falla
    onError: (_error, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(
          ["board", context.boardId],
          context.previousBoard,
        );
      }
    },

    // Opcional: invalidar para sincronizar con el servidor
    // onSettled: (_data, _error, variables) => {
    //   queryClient.invalidateQueries({ queryKey: ["board", variables.boardId] });
    // },
  });
}

//  SELECTORS Y HOOKS OPTIMIZADOS

/**
 * Crea un Map de todos los canales (raíz + categorías) para lookup O(1)
 * @param board - Board data
 * @returns Map de channelId -> BoardChannel
 */
function createChannelsMap(
  board: BoardWithData | undefined,
): Map<string, BoardChannel> {
  const map = new Map<string, BoardChannel>();
  if (!board) return map;
  board.channels.forEach((c) => map.set(c.id, c));
  return map;
}

/**
 * Crea un Map de profileId -> member para lookup O(1)
 * @param board - Board data
 * @returns Map de profileId -> BoardMember
 */
function createMembersMap(
  board: BoardWithData | undefined,
): Map<string, BoardWithData["members"][number]> {
  const map = new Map<string, BoardWithData["members"][number]>();
  if (!board) return map;

  board.members.forEach((m) => {
    if (m.profileId) {
      map.set(m.profileId, m);
    }
  });

  return map;
}

/**
 * Hook para obtener un Map de canales desde un board ya resuelto.
 * Evita suscripciones duplicadas al query cuando el board ya fue leido
 * en un componente padre.
 */
export function useBoardChannelsMap(
  board: BoardWithData | undefined,
): Map<string, BoardChannel> {
  return useMemo(() => createChannelsMap(board), [board]);
}

/**
 * Hook para obtener un Map de miembros desde un board ya resuelto.
 * Evita suscripciones duplicadas al query cuando el board ya fue leido
 * en un componente padre.
 */
export function useBoardMembersMap(
  board: BoardWithData | undefined,
): Map<string, BoardWithData["members"][number]> {
  return useMemo(() => createMembersMap(board), [board]);
}

/**
 * Hook para obtener un Map de canales del board actual.
 * Permite lookup O(1) en lugar de busqueda anidada O(n).
 *
 * @returns Map de channelId -> BoardChannel
 */
export function useCurrentBoardChannelsMap(): Map<string, BoardChannel> {
  const { data: board } = useCurrentBoardData();
  return useBoardChannelsMap(board);
}

/**
 * Hook para obtener un Map de miembros del board actual.
 * Permite lookup O(1) para encontrar member por profileId.
 *
 * @returns Map de profileId -> BoardMember
 */
export function useCurrentBoardMembersMap(): Map<
  string,
  BoardWithData["members"][number]
> {
  const { data: board } = useCurrentBoardData();
  return useBoardMembersMap(board);
}

/**
 * Hook para obtener el member del usuario actual en el board.
 * Usa Map interno para lookup O(1).
 *
 * @param profileId - ID del perfil del usuario actual
 * @returns Member del usuario actual o undefined
 */
export function useCurrentMember(
  profileId: string,
): BoardWithData["members"][number] | undefined {
  const membersMap = useCurrentBoardMembersMap();

  return useMemo(() => membersMap.get(profileId), [membersMap, profileId]);
}

/**
 * Hook para obtener el rol del usuario actual en el board.
 * Usa Map interno para lookup O(1).
 *
 * @param profileId - ID del perfil del usuario actual
 * @returns Rol del usuario actual o undefined
 */
export function useCurrentMemberRole(
  profileId: string,
): BoardWithData["members"][number]["role"] | undefined {
  const member = useCurrentMember(profileId);
  return member?.role;
}

/**
 * Hook para obtener IDs de miembros del board actual.
 * Los IDs son estables (no cambian referencia si los valores son iguales).
 *
 * @returns Array de profile IDs de los miembros
 */
export function useBoardMemberIds(): string[] {
  const { data: board } = useCurrentBoardData();

  return useMemo(() => {
    if (!board?.members) return [];
    return board.members
      .map((m) => m.profileId)
      .filter((id): id is string => id !== null);
  }, [board?.members]);
}

/**
 * Hook para obtener IDs de perfiles en slots ocupados.
 * Los IDs son estables (no cambian referencia si los valores son iguales).
 *
 * @returns Array de profile IDs en slots
 */
export function useBoardSlotProfileIds(): string[] {
  return [];
}
