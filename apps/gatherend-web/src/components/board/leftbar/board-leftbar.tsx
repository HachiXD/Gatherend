import { useCallback, useMemo } from "react";
import { LeftbarBanner } from "./leftbar-banner";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/components/providers/board-provider";
import { VoiceControlBar } from "@/components/voice-control-bar";
import { useBoardAccent } from "@/hooks/use-board-accent";
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

  const accentVars = useBoardAccent(board.imageAsset?.dominantColor);
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

  const handleForum = useCallback(() => {
    switchToForum(board.id);
  }, [switchToForum, board.id]);

  const handleRules = useCallback(() => {
    switchToRules(board.id);
  }, [switchToRules, board.id]);

  const handleMembers = useCallback(() => {
    switchToMembers(board.id);
  }, [switchToMembers, board.id]);

  return (
    <div
      className="flex h-full w-full flex-col bg-theme-bg-secondary text-primary"
      style={
        accentVars
          ? ({
              ...accentVars,
            } as React.CSSProperties)
          : undefined
      }
    >
      <LeftbarBanner
        imageAsset={board.imageAsset}
        boardName={board.name}
        boardId={board.id}
        board={board}
        role={role}
        currentProfileId={currentProfileId}
      />

      <div className="scrollbar-navigation flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-1.5">
        <div className="shrink-0 flex overflow-hidden border border-theme-channel-type-active-border -mb-1.5">
          <button
            onClick={handleRules}
            className={cn(
              "group flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-none bg-theme-channel-type-active-border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-theme-channel-type-active-text transition",
              isRules
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <ScrollText className="h-4 w-4 shrink-0" />
            <span className="leading-none group-hover:underline">Reglas</span>
          </button>
          <button
            onClick={handleForum}
            className={cn(
              "group flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 bg-theme-channel-type-active-border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-theme-channel-type-active-text transition",
              isForum
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="leading-none group-hover:underline">Foro</span>
          </button>
          <button
            onClick={handleMembers}
            className={cn(
              "group flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-1 bg-theme-channel-type-active-border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-theme-channel-type-active-text transition",
              isMembers
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="leading-none group-hover:underline">Miembros</span>
          </button>
        </div>

        <div className="shrink-0 mt-2 bg-transparent px-0.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="grid grid-cols-[0.88fr_1.12fr] gap-x-2 gap-y-2">
            <div className="flex min-h-[38px] flex-col justify-center gap-0.5 border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-2 py-1 text-theme-channel-type-active-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-channel-type-active-text/70">
                Miembros
              </p>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="mt-0.5">
                  {board.members.length.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex min-h-[38px] flex-col justify-center gap-0 border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-2 py-0 text-theme-channel-type-active-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-channel-type-active-text/70">
                En linea
              </p>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Circle className="h-2.5 w-2.5 shrink-0 fill-emerald-500 text-emerald-500" />
                <span className="mt-0.5">{onlineCount}</span>
              </div>
            </div>
            <div className="flex min-h-[38px] flex-col justify-center gap-0.5 border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-2 py-1 text-theme-channel-type-active-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-channel-type-active-text/70">
                Chats
              </p>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="mt-0.5">{board.channels.length}</span>
              </div>
            </div>
            <div className="flex min-h-[38px] flex-col justify-center gap-0.5 border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-2 py-1 text-theme-channel-type-active-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-channel-type-active-text/70">
                Posts esta semana
              </p>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <BookOpenText className="h-3.5 w-3.5 shrink-0" />
                <span className="mt-0.5">{board.recentPostCount7d}</span>
              </div>
            </div>
            <div className="col-span-2 flex min-h-[38px] flex-col justify-center gap-0.5 border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-2 py-1 text-theme-channel-type-active-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_1px_0_0_rgba(255,255,255,0.14),inset_-1px_0_0_rgba(0,0,0,0.40),inset_0_-1px_0_rgba(0,0,0,0.55)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-theme-channel-type-active-text/70">
                Fecha de creacion
              </p>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                <span className="mt-0.5">{createdDate}</span>
              </div>
            </div>
          </div>
        </div>

        {board.description && (
          <div className="border border-theme-border bg-theme-bg-overlay-primary/78 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)]">
            <h3 className="-mt-0.5 mb-2 border-b border-theme-border pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
              Descripcion
            </h3>
            <p className="line-clamp-6 text-[12px] leading-relaxed text-theme-text-secondary">
              {board.description}
            </p>
          </div>
        )}
      </div>

      <VoiceControlBar position="left" />
    </div>
  );
};
