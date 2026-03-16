import { useMemo } from "react";
import { LeftbarBanner } from "./leftbar-banner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeftbarClient } from "./board-leftbar-client";
import { LeftbarChannel } from "./leftbar-channel";
import { MemberRole, ChannelType } from "@prisma/client";
import type { BoardWithData } from "@/components/providers/board-provider";
import { VoiceControlBar } from "@/components/voice-control-bar";

interface BoardLeftbarProps {
  board: BoardWithData;
  role?: MemberRole;
  currentProfileId: string;
}

export const BoardLeftbar = ({
  board,
  role,
  currentProfileId,
}: BoardLeftbarProps) => {
  // Extraer el canal MAIN (único por board)
  const mainChannel = useMemo(
    () => board.channels.find((ch) => ch.type === ChannelType.MAIN),
    [board.channels],
  );

  // Filtrar canales MAIN del initialTree
  const initialTree = useMemo(
    () => ({
      rootChannels: board.channels
        .filter((ch) => ch.type !== ChannelType.MAIN)
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          position: ch.position,
          parentId: null as null,
        })),

      rootCategories: board.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        position: cat.position,
        channels: cat.channels
          .filter((ch) => ch.type !== ChannelType.MAIN)
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            position: ch.position,
            parentId: cat.id,
          })),
      })),
    }),
    [board.channels, board.categories],
  );

  return (
    <div className="flex flex-col h-full w-full text-primary">
      {/* Banner con imagen del board y dropdown menu */}
      <LeftbarBanner
        imageAsset={board.imageAsset}
        boardName={board.name}
        boardId={board.id}
        board={board}
        role={role}
        currentProfileId={currentProfileId}
      />

      {/* Canal MAIN fijo (no scrolleable) */}
      {mainChannel && (
        <div className="py-1 px-1 border-b border-border/40">
          <LeftbarChannel
            channel={mainChannel}
            boardId={board.id}
            role={role}
          />
        </div>
      )}

      {/* Contenedor con borde que ocupa todo el espacio restante */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Canales TEXT/VOICE scrolleables */}
        <ScrollArea className="flex-1 px-1">
          <div className="px-1.5 py-2">
            <LeftbarClient
              role={role}
              boardId={board.id}
              initialTree={initialTree}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Voice Control Bar - aparece al final cuando hay llamada activa */}
      <VoiceControlBar position="left" />
    </div>
  );
};
