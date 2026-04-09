"use client";

import { useMemo, useEffect, useSyncExternalStore } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { LeftbarChannel } from "./leftbar-channel";
import { SortableItem } from "./leftbar-sortable-item";

import { MemberRole } from "@prisma/client";
import { useBoardData } from "@/hooks/use-board-data";
import { useVoiceParticipantsSocket } from "@/hooks/use-voice-participants-socket";
import {
  useChannelReorder,
  type ChannelTree,
} from "@/hooks/use-channel-reorder";

interface LeftbarClientProps {
  role?: MemberRole;
  boardId: string;
  dominantColor?: string | null;
}

const canReorder = (role?: MemberRole) =>
  role === MemberRole.OWNER ||
  role === MemberRole.ADMIN ||
  role === MemberRole.MODERATOR;

/**
 * Lista de canales con drag & drop para reordenar.
 * Sin categorías — todos los canales son root.
 */
export const LeftbarClient = ({
  role,
  boardId,
  dominantColor,
}: LeftbarClientProps) => {
  // false on server, true on client — avoids DnD hydration mismatch
  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const { data: board } = useBoardData(boardId);

  useVoiceParticipantsSocket(boardId);

  const tree = useMemo((): ChannelTree => {
    if (!board) return { rootChannels: [] };
    return {
      rootChannels: board.channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        position: ch.position,
        parentId: null as null,
        imageAsset: ch.imageAsset,
        channelMemberCount: ch.channelMemberCount,
      })),
    };
  }, [board]);

  const {
    rootChannels,
    sortedRootChannels,
    activeId,
    onDragStart,
    onDragEnd,
    syncTreeFromQuery,
  } = useChannelReorder({ boardId, initialTree: tree });

  useEffect(() => {
    syncTreeFromQuery(tree);
  }, [tree, syncTreeFromQuery]);

  const pointerSensorOptions = useMemo(
    () => ({ activationConstraint: { distance: 8 } }),
    [],
  );
  const sensors = useSensors(useSensor(PointerSensor, pointerSensorOptions));

  const dragDisabled = !canReorder(role);

  const activeChannel = useMemo(
    () => (activeId ? rootChannels.find((ch) => ch.id === activeId) : null),
    [activeId, rootChannels],
  );

  // Pre-render without DnD to avoid hydration mismatch
  if (!isMounted) {
    return (
        <div className="flex flex-col gap-1">
          {sortedRootChannels.map((ch) => (
            <LeftbarChannel
              key={ch.id}
              channel={ch}
              boardId={boardId}
              role={role}
              dominantColor={dominantColor}
            />
          ))}
        </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext
        items={sortedRootChannels.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {sortedRootChannels.map((ch) => (
            <SortableItem key={ch.id} id={ch.id} disableDrag={dragDisabled}>
              <LeftbarChannel
                channel={ch}
                boardId={boardId}
                role={role}
                dominantColor={dominantColor}
              />
            </SortableItem>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeChannel ? (
          <LeftbarChannel
            channel={activeChannel}
            boardId={boardId}
            role={role}
            dominantColor={dominantColor}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
