"use client";

import { memo, useMemo } from "react";
import {
  TextAlignJustify,
  TextAlignStart,
  Plus,
  Edit,
  Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelType, MemberRole } from "@prisma/client";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { isModerator } from "@/lib/domain-client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "./leftbar-sortable-item";
import { LeftbarChannel } from "./leftbar-channel";

interface Props {
  category: {
    id: string;
    name: string;
    position: number;
    channels: {
      id: string;
      name: string;
      type: ChannelType;
      parentId: string;
      position: number;
    }[];
  };
  boardId: string;
  role?: MemberRole;
  isOpen: boolean;
  toggleOpen: () => void;
}

const LeftbarCategoryComponent = ({
  category,
  boardId,
  role,
  isOpen,
  toggleOpen,
}: Props) => {
  const { onOpen } = useModal();

  // Memoizar sortedChannels
  const sortedChannels = useMemo(
    () => [...category.channels].sort((a, b) => a.position - b.position),
    [category.channels],
  );

  return (
    <div className="w-full">
      <button
        onClick={toggleOpen}
        className={cn(
          "group flex items-center justify-between w-full px-2 py-1.5 rounded-md transition",
          "bg-theme-border-secondary",

          // Hover igual que canal
          "hover:bg-theme-border-primary",

          // Texto base igual que canal
          "text-theme-text-secondary",
        )}
      >
        <div className="flex items-center gap-x-1">
          {isOpen ? (
            <TextAlignStart className="w-4 h-4 text-theme-text-tertiary" />
          ) : (
            <TextAlignJustify className="w-4 h-4 text-theme-text-tertiary" />
          )}
          <span className="font-semibold text-sm text-theme-text-secondary">
            {category.name}
          </span>
        </div>

        {isModerator(role) && (
          <div className="flex items-center gap-x-1">
            <ActionTooltip label="Add Room">
              <Plus
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen("createChannel", {
                    boardId,
                    categoryId: category.id,
                  });
                }}
                className="w-4 h-4 text-theme-text-tertiary hover:text-theme-text-primary"
              />
            </ActionTooltip>

            <ActionTooltip label="Edit">
              <Edit
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen("editCategory", {
                    boardId,
                    categoryId: category.id,
                  });
                }}
                className="w-4 h-4 text-theme-text-tertiary hover:text-theme-text-primary"
              />
            </ActionTooltip>

            <ActionTooltip label="Delete Category">
              <Trash
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen("deleteCategory", {
                    boardId,
                    categoryId: category.id,
                    categoryName: category.name,
                  });
                }}
                className="w-4 h-4 text-theme-text-tertiary hover:text-theme-text-primary"
              />
            </ActionTooltip>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="mt-1 ml-2 space-y-[2px]">
          <SortableContext
            items={sortedChannels.map((ch) => ch.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-1"></div>
            {sortedChannels.map((channel) => (
              <div
                key={channel.id}
                className={
                  channel.type === ChannelType.TEXT ? "" : "col-span-2"
                }
              >
                <SortableItem key={channel.id} id={channel.id}>
                  <LeftbarChannel
                    channel={channel}
                    boardId={boardId}
                    role={role}
                  />
                </SortableItem>
              </div>
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
};

// Export memoizado
export const LeftbarCategory = memo(LeftbarCategoryComponent, (prev, next) => {
  return (
    prev.category.id === next.category.id &&
    prev.category.name === next.category.name &&
    prev.category.position === next.category.position &&
    prev.category.channels.length === next.category.channels.length &&
    prev.isOpen === next.isOpen &&
    prev.role === next.role
  );
});
