import { useCallback, useMemo } from "react";
import { LeftbarBanner } from "./leftbar-banner";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/components/providers/board-provider";
import { VoiceControlBar } from "@/components/voice-control-bar";
import {
  Users,
  MessagesSquare,
  MessageSquare,
  Circle,
  BookOpenText,
  ScrollText,
} from "lucide-react";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { usePresenceStore } from "@/hooks/use-presence-store";
import { cn } from "@/lib/utils";

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
  const createdDate = (() => {
    const d = new Date(board.createdAt);
    const day = d.getDate().toString().padStart(2, "0");
    const month = d.toLocaleString("es", { month: "long" });
    const year = d.getFullYear();
    return `${day} de ${month} de ${year}`;
  })();

  const memberProfileIds = useMemo(
    () => board.members.map((m) => m.profileId),
    [board.members],
  );

  const onlineCount = usePresenceStore(
    useCallback(
      (state) => {
        let count = 0;
        for (const id of memberProfileIds) {
          if (state.onlineUsers.has(id)) count++;
        }
        return count;
      },
      [memberProfileIds],
    ),
  );

  const isForum = useBoardNavigationStore(
    useCallback((state) => state.isForum, []),
  );
  const isRules = useBoardNavigationStore(
    useCallback((state) => state.isRules, []),
  );
  const isMembers = useBoardNavigationStore(
    useCallback((state) => state.isMembers, []),
  );
  const switchToForum = useBoardNavigationStore(
    useCallback((state) => state.switchToForum, []),
  );
  const switchToRules = useBoardNavigationStore(
    useCallback((state) => state.switchToRules, []),
  );
  const switchToMembers = useBoardNavigationStore(
    useCallback((state) => state.switchToMembers, []),
  );

  // Navigate to forum view for this board
  const handleForum = useCallback(() => {
    switchToForum(board.id);
  }, [switchToForum, board.id]);

  // Navigate to rules view for this board
  const handleRules = useCallback(() => {
    switchToRules(board.id);
  }, [switchToRules, board.id]);

  // Navigate to members view for this board
  const handleMembers = useCallback(() => {
    switchToMembers(board.id);
  }, [switchToMembers, board.id]);

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

      {/* Resumen del board */}
      <div className="scrollbar-navigation flex-1 min-h-0 overflow-y-auto px-2 pt-2 pb-1.5 flex flex-col gap-2">
        {/* Navigation buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={handleRules}
            className={cn(
              "flex h-16 flex-1 cursor-pointer flex-col rounded-none border overflow-hidden text-[16px] font-medium transition shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]",
              isRules
                ? "border-theme-channel-type-active-border bg-theme-channel-type-active-border text-theme-channel-type-active-text"
                : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
            )}
          >
            <span className="flex w-full items-center justify-center border-b border-current/40 px-3 py-0">
              Reglas
            </span>
            <div className="flex flex-1 items-center justify-center bg-black/15">
              <ScrollText className="h-6 w-6 mb-1" />
            </div>
          </button>
          <button
            onClick={handleForum}
            className={cn(
              "flex h-16 flex-1 cursor-pointer flex-col rounded-none border overflow-hidden text-[16px] font-medium transition shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]",
              isForum
                ? "border-theme-channel-type-active-border bg-theme-channel-type-active-border text-theme-channel-type-active-text"
                : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
            )}
          >
            <span className="flex w-full items-center justify-center border-b border-current/40 px-3 py-0">
              Foro
            </span>
            <div className="flex flex-1 items-center justify-center bg-black/15">
              <MessageSquare className="h-6 w-6 mb-1" />
            </div>
          </button>
          <button
            onClick={handleMembers}
            className={cn(
              "flex h-16 flex-1 cursor-pointer flex-col rounded-none border overflow-hidden text-[16px] font-medium transition shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]",
              isMembers
                ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
            )}
          >
            <span className="flex w-full items-center justify-center border-b border-current/40 px-3 py-0">
              Miembros
            </span>
            <div className="flex flex-1 items-center justify-center bg-black/15">
              <Users className="h-6 w-6 mb-1" />
            </div>
          </button>
        </div>

        {/* Stats */}
        <div className="border border-theme-border bg-theme-bg-overlay-primary/78 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)]">
          <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-theme-text-subtle">
                Miembros
              </p>
              <div className="flex h-7 items-center gap-1.5 border border-theme-border-subtle bg-theme-bg-edit-form/35 px-1.5 text-[12px] text-theme-text-muted">
                <Users className="h-3 w-3  shrink-0" />
                <span className="mt-0.5">
                  {board.members.length.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-theme-text-subtle">
                En línea
              </p>
              <div className="flex h-7 items-center gap-1.5 border border-theme-border-subtle bg-theme-bg-edit-form/35 px-1.5 text-[12px] text-theme-text-muted">
                <Circle className="h-2.5 w-2.5 shrink-0 fill-emerald-500 text-emerald-500" />
                <span className="mt-0.5">{onlineCount}</span>
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-theme-text-subtle">
                Rooms
              </p>
              <div className="flex h-7 items-center gap-1.5 border border-theme-border-subtle bg-theme-bg-edit-form/35 px-1.5 text-[12px] text-theme-text-muted">
                <MessagesSquare className="h-3 w-3 shrink-0" />
                <span className="mt-0.5">{board.channels.length}</span>
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-theme-text-subtle">
                Posts esta semana
              </p>
              <div className="flex h-7 items-center gap-1.5 border border-theme-border-subtle bg-theme-bg-edit-form/35 px-1.5 text-[12px] text-theme-text-muted">
                <BookOpenText className="h-3 w-3 shrink-0" />
                <span className="mt-0.5">{board.recentPostCount7d}</span>
              </div>
            </div>
            <div className="col-span-2">
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-theme-text-subtle">
                Fecha de Creación
              </p>
              <div className="flex h-7 items-center gap-1.5 border border-theme-border-subtle bg-theme-bg-edit-form/35 px-1.5 text-[12px] text-theme-text-muted">
                <span>{createdDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {board.description && (
          <div className="border border-theme-border bg-theme-bg-overlay-primary/78 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)]">
            <h3 className="border-b border-theme-border -mt-0.5 pb-1 mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
              Descripción
            </h3>
            <p className="text-[12px] text-theme-text-secondary leading-relaxed line-clamp-6">
              {board.description}
            </p>
          </div>
        )}
      </div>

      {/* Voice Control Bar - aparece al final cuando hay llamada activa */}
      <VoiceControlBar position="left" />
    </div>
  );
};
