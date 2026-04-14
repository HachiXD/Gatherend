"use client";

import { memo } from "react";
import { MessagesSquare } from "lucide-react";
import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData, useCurrentMemberRole } from "@/hooks/use-board-data";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { LeftbarClient } from "@/components/board/leftbar/board-leftbar-client";
import { useTranslation } from "@/i18n";

function ChannelsViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading,
    error: boardError,
  } = useBoardData(boardId, { enableFetch: true });
  const profile = useProfile();
  const role = useCurrentMemberRole(profile.id);
  const { t } = useTranslation();

  const headerButtonStyles = useCommunityHeaderStyle();

  if (!board && isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-3 px-6 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded bg-theme-bg-secondary/70"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!board && boardError) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-destructive">
        {boardError.message}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
      <div className="h-full w-full overflow-y-auto scrollbar-chat">
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div className="px-0 h-12 flex items-center" style={headerButtonStyles}>
            <div className="ml-3 mr-3 flex items-center gap-2">
              <div className="flex min-w-0 max-w-[min(58vw,520px)] items-center justify-center gap-2 rounded-sm border border-[var(--community-header-btn-ring)] bg-theme-bg-secondary/40 px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                <MessagesSquare className="h-6 w-6 shrink-0 text-(--community-header-btn-muted)" />
                <p className="min-w-0 truncate text-center text-[20px] font-semibold text-theme-text-subtle">
                  {board ? t.board.boardChats(board.name) : t.board.channels}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 ">
          <div className="mx-auto w-full max-w-5xl">
            <div className="border rounded-sm border-theme-border bg-theme-bg-overlay-primary/78 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)]">
              <LeftbarClient boardId={boardId} role={role} twoColumns />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ChannelsView = memo(ChannelsViewInner);
