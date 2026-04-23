"use client";

import { useBoardData } from "@/hooks/use-board-data";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { BookOpenText } from "lucide-react";

function WikiViewInner() {
  const boardId = useCurrentBoardId();
  const { data: board, isLoading } = useBoardData(boardId, {
    enableFetch: true,
  });

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
            className="px-0 h-11 flex items-center bg-theme-bg-quinary"
          >
            <div className="ml-3 mr-3 flex w-full items-center gap-2">
              <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 rounded-lg px-3 py-0.5">
                <BookOpenText className="h-6 w-6 shrink-0 text-theme-text-subtle" />
                <p className="min-w-0 truncate text-center text-[20px] font-semibold text-theme-text-subtle">
                  {board ? `Wiki de ${board.name}` : "Wiki"}
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

export function WikiView() {
  return <WikiViewInner />;
}
