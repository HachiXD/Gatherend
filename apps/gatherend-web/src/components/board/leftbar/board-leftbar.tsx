import { useCallback, useMemo } from "react";
import { LeftbarBanner } from "./leftbar-banner";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/lib/boards/board-types";
import { VoiceControlBar } from "@/components/voice-control-bar";
import {
  Star,
  AtSign,
  Users,
  MessagesSquare,
  MessageSquare,
  FileText,
  BookOpenText,
  ScrollText,
  BarChart3,
  Trophy,
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
  const isWiki = useBoardNavigationStore(
    useCallback((state) => state.isWiki, []),
  );
  const isRanking = useBoardNavigationStore(
    useCallback((state) => state.isRanking, []),
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
  const switchToWiki = useBoardNavigationStore(
    useCallback((state) => state.switchToWiki, []),
  );
  const switchToRanking = useBoardNavigationStore(
    useCallback((state) => state.switchToRanking, []),
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

  const handleWiki = useCallback(() => {
    switchToWiki(board.id);
  }, [switchToWiki, board.id]);

  const handleRanking = useCallback(() => {
    switchToRanking(board.id);
  }, [switchToRanking, board.id]);

  return (
    <div className="flex h-full w-full flex-col bg-theme-bg-secondary text-primary">
      <LeftbarBanner
        imageAsset={board.imageAsset}
        bannerAsset={board.bannerAsset}
        boardName={board.name}
        boardId={board.id}
        board={board}
        role={role}
        currentProfileId={currentProfileId}
      />

      <div className="scrollbar-navigation flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-1.5">
        <div className="shrink-0 flex flex-col gap-1">
          <button
            onClick={handleChannels}
            data-mentions={hasChatMentions}
            data-unreads={hasChatUnreads}
            className={cn(
              "group/chats relative flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg bg-transparent px-3 text-[16px] font-medium tracking-[0.05em] text-theme-text-subtle transition-colors",
              isChannels
                ? "bg-theme-channel-type-active-border"
                : "hover:bg-theme-channel-type-active-border",
            )}
          >
            <MessagesSquare className="h-5.5 w-5.5 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Chats
            </span>
            <div
              className={cn(
                "absolute top-1.5 right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-theme-notification-bg",
                "group-data-[mentions=true]/chats:flex",
              )}
            >
              <AtSign
                className="h-3.5 w-3.5 text-theme-text-tertiary"
                strokeWidth={3}
              />
            </div>
            <div
              className={cn(
                "absolute left-0 inset-y-1.5 hidden w-2 rounded-r border border-theme-border-primary/70 bg-theme-unread-bg",
                "group-data-[unreads=true]/chats:block group-data-[mentions=true]/chats:hidden",
              )}
            />
          </button>
          <button
            onClick={handleForum}
            className={cn(
              "group flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg bg-transparent px-3 text-[16px] font-medium tracking-[0.05em] text-theme-text-subtle transition-colors",
              isForum
                ? "bg-theme-channel-type-active-border"
                : "hover:bg-theme-channel-type-active-border",
            )}
          >
            <MessageSquare className="h-5.5 w-4.5 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Foro
            </span>
          </button>
          <button
            onClick={handleWiki}
            className={cn(
              "group flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg bg-transparent px-3 text-[16px] font-medium tracking-[0.05em] text-theme-text-subtle transition-colors",
              isWiki
                ? "bg-theme-channel-type-active-border"
                : "hover:bg-theme-channel-type-active-border",
            )}
          >
            <BookOpenText className="h-5.5 w-5.5 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Wiki
            </span>
          </button>
          <button
            onClick={handleRules}
            className={cn(
              "group flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg bg-transparent px-3 text-[16px] font-medium tracking-[0.05em] text-theme-text-subtle transition-colors",
              isRules
                ? "bg-theme-channel-type-active-border"
                : "hover:bg-theme-channel-type-active-border",
            )}
          >
            <ScrollText className="h-5.5 w-5.5 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Reglas
            </span>
          </button>
          <button
            onClick={handleRanking}
            className={cn(
              "group flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg bg-transparent px-3 text-[16px] font-medium tracking-[0.05em] text-theme-text-subtle transition-colors",
              isRanking
                ? "bg-theme-channel-type-active-border"
                : "hover:bg-theme-channel-type-active-border",
            )}
          >
            <Trophy className="h-5.5 w-5.5 shrink-0" />
            <span className="leading-none group-hover:text-theme-text-strong">
              Ranking
            </span>
          </button>
        </div>

        <div className="shrink-0 border-t border-theme-border/60" />

        <div className="shrink-0 flex flex-col gap-2">
          {/* Nivel — full width */}
          {xpProgress && (
            <div className="flex flex-col gap-1.5 rounded-lg  bg-transparent px-3 py-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-md bg-theme-channel-type-active-border px-2 py-1">
                  <Star className="h-5 w-5 shrink-0 text-theme-text-subtle" />
                  <span className="text-[16px] font-medium leading-none  text-theme-text-subtle">
                    Nv. {xpProgress.level}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 -mb-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 shadow-inner">
                    <div
                      className="h-full rounded-full bg-[var(--theme-channel-type-active-soft-bg)] transition-all duration-500"
                      style={{ width: `${xpProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-[14px] text-theme-text-primary/40 tabular-nums">
                    {xpProgress.percent}% al siguiente nivel
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-theme-border/60" />

          {/* Stats — grid 2 columnas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-lg border border-theme-border-secondary bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium tracking-[0.06em] text-theme-text-primary/70">
                  Miembros
                </p>
                <Users className="h-5.5 w-5.5 shrink-0 text-theme-text-primary/50" />
              </div>
              <span className="text-[16px] font-medium leading-none text-theme-text-subtle tabular-nums">
                {board.memberCount.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-theme-border-secondary bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium tracking-[0.06em] text-theme-text-primary/70">
                  Chats
                </p>
                <MessagesSquare className="h-5.5 w-5.5 shrink-0 text-theme-text-primary/50" />
              </div>
              <span className="text-[16px] font-medium leading-none text-theme-text-subtle tabular-nums">
                {board.channels.length}
              </span>
            </div>
          </div>

          {/* Posts — full width horizontal */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-theme-border-secondary bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5.5 w-5.5 shrink-0 text-theme-text-primary/50" />
              <p className="text-[15px] font-medium tracking-[0.06em] text-theme-text-primary/70">
                Posts esta semana
              </p>
            </div>
            <span className="text-[16px] font-medium leading-none text-theme-text-subtle tabular-nums">
              {board.recentPostCount7d}
            </span>
          </div>

          {/* Descripción */}
          {board.description && (
            <div className="rounded-lg border border-theme-border-secondary bg-[var(--theme-channel-type-active-soft-bg)] px-3 py-2">
              <p className="mb-1 text-[15px] font-medium tracking-[0.06em] text-theme-text-primary/70">
                Descripción
              </p>
              <p className="line-clamp-5 text-[16px] leading-relaxed text-theme-text-subtle">
                {board.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <VoiceControlBar position="left" />
    </div>
  );
};
