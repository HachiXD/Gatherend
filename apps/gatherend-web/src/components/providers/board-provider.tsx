"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, ReactNode } from "react";
import {
  Board,
  Channel,
  Category,
  Member,
  Slot,
  MemberRole,
  ChannelType,
} from "@prisma/client";
import { useBoardMembersSocket } from "@/hooks/use-board-members-socket";
import type { UsernameColor, UsernameFormatConfig } from "../../../types";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

// Tipos para el board con todas sus relaciones
export type BoardChannel = {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  parentId: string | null;
  boardId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardCategory = {
  id: string;
  name: string;
  position: number;
  boardId: string;
  channels: BoardChannel[];
};

export type BoardMember = Member & {
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
    longDescription: string | null;
  };
};

export type BoardSlot = Slot & {
  member: BoardMember | null;
};

export type BoardWithData = Board & {
  imageAsset: ClientUploadedAsset | null;
  channels: BoardChannel[];
  categories: BoardCategory[];
  members: BoardMember[];
  slots: BoardSlot[];
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
    const existingData = queryClient.getQueryData(["board", initialBoard.id]);
    if (!existingData) {
      queryClient.setQueryData(["board", initialBoard.id], initialBoard);
    }
  }, [queryClient, initialBoard.id]);

  // Escuchar cambios en miembros del board via WebSocket
  useBoardMembersSocket(initialBoard.id);

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
