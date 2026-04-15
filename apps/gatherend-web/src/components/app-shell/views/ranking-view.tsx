"use client";

import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData } from "@/hooks/use-board-data";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { Trophy } from "lucide-react";

function RankingViewInner() {
  const boardId = useCurrentBoardId();
  const { data: board, isLoading } = useBoardData(boardId, {
    enableFetch: true,
  });

  const headerButtonStyles = useCommunityHeaderStyle();

  if (!board && isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
      <div className="h-full w-full overflow-y-auto scrollbar-chat">
        {/* Header */}
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div
            className="px-0 h-11 flex items-center"
            style={headerButtonStyles}
          >
            <div className="ml-3 mr-3 flex w-full items-center gap-2">
              <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 rounded-sm border border-(--community-header-btn-ring) bg-theme-bg-secondary/40 px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                <Trophy className="h-6 w-6 shrink-0 text-(--community-header-btn-muted)" />
                <p className="min-w-0 truncate text-center text-[20px] font-semibold text-theme-text-subtle">
                  {board ? `Ranking de ${board.name}` : "Ranking"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-[16px] text-theme-text-muted">
            Proximamente, Hachi está trabajando en esto :D
          </p>
        </div>
      </div>
    </div>
  );
}

export function RankingView() {
  return <RankingViewInner />;
}
