"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useBoardMembers } from "@/hooks/use-board-members";
import { BoardMember } from "@/components/providers/board-provider";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface MentionAutocompleteProps {
  inputValue: string;
  cursorPosition: number;
  onSelect: (member: BoardMember, startIndex: number, endIndex: number) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const MentionAutocomplete = ({
  inputValue,
  cursorPosition,
  onSelect,
  inputRef,
  isOpen,
  setIsOpen,
}: MentionAutocompleteProps) => {
  const { members } = useBoardMembers();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Calcular el estado de la mención de forma derivada (sin useState)
  const mentionState = useMemo(() => {
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      return {
        shouldOpen: false,
        mentionStart: -1,
        filtered: [] as BoardMember[],
      };
    }

    // Verificar que el @ no esté en medio de una palabra
    const charBeforeAt =
      lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
    if (charBeforeAt !== " " && charBeforeAt !== "\n" && lastAtIndex !== 0) {
      return {
        shouldOpen: false,
        mentionStart: -1,
        filtered: [] as BoardMember[],
      };
    }

    // Obtener el texto después del @
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

    // Si hay un espacio después del @, cerrar el autocomplete
    if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
      return {
        shouldOpen: false,
        mentionStart: -1,
        filtered: [] as BoardMember[],
      };
    }

    // Filtrar miembros por username
    const filtered = members.filter((member) =>
      member.profile.username.toLowerCase().includes(textAfterAt.toLowerCase())
    );

    return {
      shouldOpen: filtered.length > 0,
      mentionStart: lastAtIndex,
      filtered,
    };
  }, [inputValue, cursorPosition, members]);

  // Sincronizar isOpen con el estado calculado
  useEffect(() => {
    if (mentionState.shouldOpen !== isOpen) {
      setIsOpen(mentionState.shouldOpen);
    }
  }, [mentionState.shouldOpen, isOpen, setIsOpen]);

  // Reset selected index cuando cambian los resultados
  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionState.filtered.length]);

  // Handler para seleccionar un miembro
  const handleSelect = useCallback(
    (member: BoardMember) => {
      onSelect(member, mentionState.mentionStart, cursorPosition);
      setIsOpen(false);
    },
    [onSelect, mentionState.mentionStart, cursorPosition, setIsOpen]
  );

  // Manejar navegación con teclado
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || mentionState.filtered.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < mentionState.filtered.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : mentionState.filtered.length - 1
          );
          break;
        case "Tab":
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          handleSelect(mentionState.filtered[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, mentionState.filtered, selectedIndex, setIsOpen, handleSelect]
  );

  // Agregar listener de teclado al input
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener("keydown", handleKeyDown);
    return () => {
      input.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef, handleKeyDown]);

  // Scroll al elemento seleccionado
  useEffect(() => {
    if (listRef.current && mentionState.filtered.length > 0) {
      const container = listRef.current.querySelector(".mention-list");
      const selectedElement = container?.children[
        selectedIndex + 1
      ] as HTMLElement; // +1 porque el primer hijo es el header
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, mentionState.filtered.length]);

  if (!isOpen || mentionState.filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-4 right-4 mb-2 max-h-[200px] overflow-y-auto
        bg-theme-bg-tertiary rounded-md shadow-lg border border-theme-border-primary
        z-50"
    >
      <div className="p-1 mention-list">
        <p className="text-xs text-theme-text-subtle px-2 py-1 uppercase font-semibold">
          Members
        </p>
        {mentionState.filtered.map((member, index) => (
          <button
            key={member.id}
            type="button"
            onClick={() => handleSelect(member)}
            className={cn(
              "w-full flex cursor-pointer items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
              index === selectedIndex
                ? "bg-theme-accent-primary/20"
                : "hover:bg-theme-channel-hover"
            )}
          >
            <UserAvatar
              src={member.profile.avatarAsset?.url || undefined}
              profileId={member.profileId ?? undefined}
              className="h-6 w-6"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-theme-text-primary truncate">
                {member.profile.username}
              </p>
            </div>
            <span className="text-xs text-theme-text-muted">
              /{member.profile.discriminator}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
