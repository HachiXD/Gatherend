"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, ReactNode } from "react";
import { Board, Member, MemberRole, ChannelType } from "@prisma/client";
import { syncUserBoardFromBoardData } from "@/hooks/use-user-boards";
import type { UsernameColor, UsernameFormatConfig } from "../../../types";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";
import { boardQueryKey } from "@/hooks/board-cache";

// Tipos para el board con todas sus relaciones
export type BoardChannel = {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  boardId: string;
  imageAsset: ClientUploadedAsset | null;
  channelMemberCount: number;
  isJoined: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardMember = Member & {
  activeWarningCount: number;
  latestActiveWarningId: string | null;
  profile: {
    id: string;
    username: string;
    discriminator: string;
    avatarAsset: ClientUploadedAsset | null;
    usernameColor: UsernameColor;
    profileTags: string[];
    badge: string | null;
    badgeSticker: ClientStickerAssetRef | null;
    usernameFormat: UsernameFormatConfig | null;
  };
};

export type BoardCurrentMember = Pick<
  Member,
  "id" | "role" | "profileId" | "boardId" | "level" | "xp" | "createdAt" | "updatedAt"
>;

export type BoardWithData = Omit<Board, "memberCount"> & {
  imageAsset: ClientUploadedAsset | null;
  channels: BoardChannel[];
  currentMember: BoardCurrentMember | null;
  memberCount: number;
};

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
