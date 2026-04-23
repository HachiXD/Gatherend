"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, ReactNode } from "react";
import { MemberRole } from "@prisma/client";
import { syncUserBoardFromBoardData } from "@/hooks/use-user-boards";
import type { BoardWithData } from "@/lib/boards/board-types";
import { boardQueryKey } from "@/lib/boards/board-query";

interface BoardContextValue {
  boardId: string;
  profileId: string;
  role?: MemberRole;
}

const BoardContext = createContext<BoardContextValue | null>(null);

interface BoardProviderProps {
  children: ReactNode;
  initialBoard: BoardWithData;
  profileId: string;
  role?: MemberRole;
}

export const BoardProvider = ({
  children,
  initialBoard,
  profileId,
  role,
}: BoardProviderProps) => {
  const queryClient = useQueryClient();

  // Hidratar React Query con datos del server SOLO si no hay datos existentes
  // Esto evita sobrescribir datos actualizados por WebSocket
  useEffect(() => {
    const existingData = queryClient.getQueryData(boardQueryKey(initialBoard.id));
    if (!existingData) {
      queryClient.setQueryData(boardQueryKey(initialBoard.id), initialBoard);
    }

    syncUserBoardFromBoardData(queryClient, initialBoard);
  }, [queryClient, initialBoard]);

  return (
    <BoardContext.Provider
      value={{
        boardId: initialBoard.id,
        profileId,
        role,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
};

export const useBoardContext = () => {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error("useBoardContext must be used within a BoardProvider");
  }
  return context;
};
