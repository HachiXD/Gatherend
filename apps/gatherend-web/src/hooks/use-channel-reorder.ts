"use client";

import { useState, useMemo, useCallback } from "react";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ChannelType } from "@prisma/client";
import axios from "axios";
import { fractional } from "@/lib/fractional";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

// Types
export interface RootChannel {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  parentId: null;
  imageAsset?: ClientUploadedAsset | null;
  channelMemberCount?: number;
}

export interface ChannelTree {
  rootChannels: RootChannel[];
}

interface UseChannelReorderOptions {
  boardId: string;
  initialTree: ChannelTree;
}

interface UseChannelReorderReturn {
  rootChannels: RootChannel[];
  sortedRootChannels: RootChannel[];
  activeId: string | null;
  setRootChannels: React.Dispatch<React.SetStateAction<RootChannel[]>>;
  onDragStart: (event: DragEndEvent) => void;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  syncTreeFromQuery: (tree: ChannelTree) => void;
}

/**
 * Hook para manejar la lógica de reordenamiento de canales.
 */
export function useChannelReorder({
  boardId,
  initialTree,
}: UseChannelReorderOptions): UseChannelReorderReturn {
  const [rootChannels, setRootChannels] = useState<RootChannel[]>(
    initialTree.rootChannels
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const syncTreeFromQuery = useCallback((tree: ChannelTree) => {
    setRootChannels(tree.rootChannels);
  }, []);

  const sortedRootChannels = useMemo(
    () => [...rootChannels].sort((a, b) => a.position - b.position),
    [rootChannels]
  );

  const onDragStart = useCallback((event: DragEndEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const draggedId = String(active.id);
      const targetId = String(over.id);

      if (draggedId === targetId) return;

      const activeIndex = sortedRootChannels.findIndex((c) => c.id === draggedId);
      const overIndex = sortedRootChannels.findIndex((c) => c.id === targetId);

      if (activeIndex === -1 || overIndex === -1) return;

      const newOrder = arrayMove([...sortedRootChannels], activeIndex, overIndex);

      const prev = newOrder[overIndex - 1]?.position ?? null;
      const next = newOrder[overIndex + 1]?.position ?? null;
      const newPosition = fractional(prev, next);

      const updated = newOrder.map((ch, idx) =>
        idx === overIndex ? { ...ch, position: newPosition } : ch
      );

      setRootChannels(updated);

      await axios.post(`/api/boards/${boardId}/reorder`, {
        id: draggedId,
        position: newPosition,
        type: "channels",
      });
    },
    [sortedRootChannels, boardId]
  );

  return {
    rootChannels,
    sortedRootChannels,
    activeId,
    setRootChannels,
    onDragStart,
    onDragEnd,
    syncTreeFromQuery,
  };
}

