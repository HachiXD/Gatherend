import { useSocketClient } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

interface MemberJoinedPayload {
  boardId: string;
  profile: Pick<ClientProfileSummary, "id" | "username" | "avatarAsset">;
  timestamp: number;
}

interface MemberLeftPayload {
  boardId: string;
  profileId: string;
  timestamp: number;
}

/**
 * Hook para escuchar cambios en los miembros del board via WebSocket
 *
 * Eventos:
 * - board:member-joined - Cuando un nuevo miembro se une
 * - board:member-left - Cuando un miembro deja el board
 *
 * @param boardId - ID del board a observar
 */
export function useBoardMembersSocket(boardId: string | undefined) {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !boardId) return;

    // Unirse a la sala del board para recibir actualizaciones
    socket.emit("join-board", { boardId });

    const handleMemberJoined = (payload: MemberJoinedPayload) => {

      if (payload.boardId !== boardId) return;

      // Forzar refetch del board para actualizar la lista de miembros
      queryClient.refetchQueries({ queryKey: ["board", boardId] });
    };

    const handleMemberLeft = (payload: MemberLeftPayload) => {

      if (payload.boardId !== boardId) return;

      // Forzar refetch del board para actualizar la lista de miembros
      queryClient.refetchQueries({ queryKey: ["board", boardId] });
    };

    socket.on("board:member-joined", handleMemberJoined);
    socket.on("board:member-left", handleMemberLeft);

    return () => {
      socket.off("board:member-joined", handleMemberJoined);
      socket.off("board:member-left", handleMemberLeft);
      // No hacemos leave-board aquí porque otros hooks pueden necesitar la sala
    };
  }, [socket, boardId, queryClient]);
}

