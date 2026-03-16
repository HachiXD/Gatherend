import { memo, useMemo } from "react";
import { getSlotPositions } from "./geometry/get-slot-positions";
import { MemberAvatar } from "./member-avatar";
import { SlotMode } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { SlotAvatar } from "./slot-avatar";
import { logger } from "@/lib/logger";
import type { BoardMember } from "@/components/providers/board-provider";

const sizeClassMap: Record<number, string> = {
  4: "h-4 w-4",
  5: "h-5 w-5",
  6: "h-6 w-6",
  7: "h-7 w-7",
  8: "h-8 w-8",
  9: "h-9 w-9",
  10: "h-10 w-10",
  11: "h-11 w-11",
  12: "h-12 w-12",
  14: "h-14 w-14",
  16: "h-16 w-16",
  20: "h-20 w-20",
};

interface MemberGridProps {
  slots: {
    id: string;
    mode: SlotMode;
    member: BoardMember | null;
  }[];
  currentProfileId: string;
  currentProfile?: ClientProfile;
}

/**
 * Grid de slots de miembros del board.
 * Memoiza el reordenamiento para poner al usuario actual primero.
 */
const SlotGridComponent = ({
  slots,
  currentProfileId,
  currentProfile,
}: MemberGridProps) => {
  // Guard para evitar error si slots es undefined
  if (!slots || slots.length === 0) {
    return null;
  }

  const { positions, avatarSize } = getSlotPositions(slots.length);

  // Memoizar el reordenamiento de slots
  const reorderedSlots = useMemo(() => {
    const result = [...slots];
    const meIndex = result.findIndex(
      (s) => s.member?.profileId === currentProfileId,
    );

    if (meIndex !== -1 && meIndex !== 0) {
      const tmp = result[0];
      result[0] = result[meIndex];
      result[meIndex] = tmp;
    }

    return result;
  }, [slots, currentProfileId]);

  // Memoizar cálculo de clases de tamaño
  const { baseClass, highlightClass } = useMemo(() => {
    const base =
      sizeClassMap[avatarSize] ??
      sizeClassMap[Math.round(avatarSize)] ??
      "h-4 w-4";
    // Para boards grandes (>25 slots), no destacar el avatar del usuario actual
    const highlight =
      slots.length > 25
        ? base
        : (sizeClassMap[avatarSize + 1] ??
          sizeClassMap[Math.round(avatarSize) + 1] ??
          base);
    return { baseClass: base, highlightClass: highlight };
  }, [avatarSize, slots.length]);

  return (
    <div className="relative w-full h-[250px]">
      {reorderedSlots.map((slot, i) => {
        // Validar que existe la posición para este índice
        if (!positions[i]) {
          logger.warn(`No position found for slot index ${i}`);
          return null;
        }

        if (slot.member) {
          const isCurrent = slot.member.profileId === currentProfileId;
          return (
            <MemberAvatar
              key={slot.id}
              member={slot.member}
              currentProfileId={currentProfileId}
              currentProfile={currentProfile}
              x={positions[i].x}
              y={positions[i].y}
              size={isCurrent ? highlightClass : baseClass}
            />
          );
        }

        // Si está libre → render slot avatar
        return (
          <SlotAvatar
            key={slot.id}
            x={positions[i].x}
            y={positions[i].y}
            size={baseClass}
            mode={slot.mode}
          />
        );
      })}
    </div>
  );
};

// Export memoizado
export const SlotGrid = memo(SlotGridComponent);
