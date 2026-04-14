import { useCallback, useMemo } from "react";
import { LeftbarBanner } from "./leftbar-banner";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/components/providers/board-provider";
import { VoiceControlBar } from "@/components/voice-control-bar";
import {
  ArrowBigUpDash,
  AtSign,
  Users,
  MessagesSquare,
  MessageSquare,
  BookOpenText,
  ScrollText,
} from "lucide-react";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { cn } from "@/lib/utils";
import { MEMBER_LEVEL_XP_THRESHOLDS } from "@/lib/domain";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";

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

  const xpProgress = (() => {
    const member = board.currentMember;
    if (!member) return null;
    const level = member.level as keyof typeof MEMBER_LEVEL_XP_THRESHOLDS;
    const nextLevel = (member.level +
      1) as keyof typeof MEMBER_LEVEL_XP_THRESHOLDS;
    const currentLevelXp = MEMBER_LEVEL_XP_THRESHOLDS[level] ?? 0;
    const nextLevelXp = MEMBER_LEVEL_XP_THRESHOLDS[nextLevel] ?? null;
    if (nextLevelXp === null)
      return { level: member.level, percent: 100, isMax: true };
    const range = nextLevelXp - currentLevelXp;
    const progress = member.xp - currentLevelXp;
    const percent = Math.min(
      100,
      Math.max(0, Math.round((progress / range) * 100)),
    );
    return { level: member.level, percent, isMax: false };
  })();

  const channelIds = useMemo(
    () => board.channels.map((channel) => channel.id),
    [board.channels],
  );

  const isForum = useBoardNavigationStore(
    useCallback((state) => state.isForum, []),
  );
  const isChannels = useBoardNavigationStore(
    useCallback(
      (state) => state.isChannels || Boolean(state.currentChannelId),
      [],
    ),
  );

  const hasChatUnreads = useUnreadStore(
    useCallback(
      (state) => channelIds.some((channelId) => state.unreads[channelId] > 0),
      [channelIds],
    ),
  );
  const hasChatMentions = useMentionStore(
    useCallback(
      (state) =>
        channelIds.some((channelId) => state.mentions[channelId] === true),
      [channelIds],
    ),
  );

  const isRules = useBoardNavigationStore(
    useCallback((state) => state.isRules, []),
  );
  const switchToForum = useBoardNavigationStore(
    useCallback((state) => state.switchToForum, []),
  );
  const switchToChannels = useBoardNavigationStore(
    useCallback((state) => state.switchToChannels, []),
  );
  const switchToRules = useBoardNavigationStore(
    useCallback((state) => state.switchToRules, []),
  );

  const handleForum = useCallback(() => {
    switchToForum(board.id);
  }, [switchToForum, board.id]);

  const handleChannels = useCallback(() => {
    switchToChannels(board.id);
  }, [switchToChannels, board.id]);

  const handleRules = useCallback(() => {
    switchToRules(board.id);
  }, [switchToRules, board.id]);

  return (
    <div className="flex h-full w-full flex-col bg-theme-bg-secondary text-primary">
      <LeftbarBanner
        imageAsset={board.imageAsset}
        boardName={board.name}
        boardId={board.id}
        board={board}
        role={role}
        currentProfileId={currentProfileId}
      />

      <div className="scrollbar-navigation flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pt-3 pb-2">
        <div className="shrink-0 flex overflow-hidden rounded-sm border border-theme-channel-type-active-border">
          <button
            onClick={handleChannels}
            data-mentions={hasChatMentions}
            data-unreads={hasChatUnreads}
            className={cn(
              "group/chats relative flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 bg-theme-channel-type-active-border px-2 text-[14px] font-bold tracking-[0.05em] text-theme-text-primary transition-colors",
              isChannels
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "hover:bg-[var(--theme-channel-type-hover-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <MessagesSquare className="h-6 w-6 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Chats
            </span>
            <div
              className={cn(
                "absolute right-2 top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-black/30 bg-theme-notification-bg",
                "group-data-[mentions=true]/chats:flex",
              )}
            >
              <AtSign
                className="h-2.5 w-2.5 text-theme-text-tertiary"
                strokeWidth={3}
              />
            </div>
            <div
              className={cn(
                "absolute bottom-1.5 right-2 hidden h-2.5 w-2.5 rounded-sm bg-theme-unread-bg",
                "group-data-[unreads=true]/chats:block group-data-[mentions=true]/chats:hidden",
              )}
            />
          </button>
          <button
            onClick={handleRules}
            className={cn(
              "group flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-l border-theme-border/50 bg-theme-channel-type-active-border px-2 text-[14px] font-bold tracking-[0.05em] text-theme-text-primary transition-colors",
              isRules
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "hover:bg-[var(--theme-channel-type-hover-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <ScrollText className="h-6 w-6 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Reglas
            </span>
          </button>
          <button
            onClick={handleForum}
            className={cn(
              "group flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-l border-theme-border/50 bg-theme-channel-type-active-border px-2 text-[14px] font-bold tracking-[0.05em] text-theme-text-primary transition-colors",
              isForum
                ? "bg-[var(--theme-button-primary-active)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]"
                : "hover:bg-[var(--theme-channel-type-hover-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.55)]",
            )}
          >
            <MessageSquare className="h-6 w-6 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Foro
            </span>
          </button>
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            {xpProgress && (
              <div className="col-span-2 flex min-h-[38px] flex-col justify-center gap-0.5 rounded-sm border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-3 pt-2 pb-2.5 text-theme-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.2)]">
                <p className="text-[14px] font-bold  tracking-[0.06em] text-theme-text-primary/70">
                  Eres nivel
                </p>
                <div className="flex items-center gap-2 text-[16px] font-semibold text-theme-text-secondary">
                  <ArrowBigUpDash className="h-5 w-5 shrink-0" />

                  <span className="text-theme-text-strong font-bold leading-none">
                    {xpProgress.level}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 ml-1">
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-black/40 shadow-inner">
                      <div
                        className="h-full rounded-sm bg-theme-text-primary transition-all duration-500"
                        style={{ width: `${xpProgress.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex min-h-[42px] flex-col justify-center gap-0 rounded-sm border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2 text-theme-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.2)]">
              <p className="text-[14px] font-bold  tracking-[0.06em] text-theme-text-primary/70">
                Miembros
              </p>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-theme-text-secondary">
                <Users className="h-5 w-5 shrink-0" />
                <span className="mt-0.5 text-theme-text-strong">
                  {board.memberCount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex min-h-[42px] flex-col justify-center gap-0 rounded-sm border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2 text-theme-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.2)]">
              <p className="text-[14px] font-bold  tracking-[0.06em] text-theme-text-primary/70">
                Chats
              </p>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-theme-text-secondary">
                <MessagesSquare className="h-5 w-5 shrink-0" />
                <span className="mt-0.5 text-theme-text-strong">
                  {board.channels.length}
                </span>
              </div>
            </div>
            <div className="col-span-2 flex min-h-[42px] flex-col justify-center gap-0 rounded-sm border border-theme-channel-type-active-border bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2 text-theme-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.2)]">
              <p className="text-[14px] font-bold  tracking-[0.06em] text-theme-text-primary/70">
                Posts esta semana
              </p>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-theme-text-secondary">
                <BookOpenText className="h-5 w-5 shrink-0" />
                <span className="mt-0.5 text-theme-text-strong">
                  {board.recentPostCount7d}
                </span>
              </div>
            </div>
          </div>
        </div>

        {board.description && (
          <div className="mt-1 rounded-sm border border-theme-border bg-theme-bg-overlay-primary/40 px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-theme-text-muted">
              Descripción
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
