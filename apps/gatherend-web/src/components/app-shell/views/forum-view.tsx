"use client";

import { memo, useCallback, useRef, useState } from "react";
import { MessageSquare, Plus, RefreshCw } from "lucide-react";
import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData, useCurrentMemberRole } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { CommunityPostsSection } from "./community-posts-section";
import { InlineCommunityPostForm } from "./inline-community-post-form";

function ForumViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading,
    error: boardError,
    refetch,
  } = useBoardData(boardId, { enableFetch: true });
  const profile = useProfile();
  const role = useCurrentMemberRole(profile.id);
  const _canDeleteAnyPost =
    role === MemberRole.OWNER ||
    role === MemberRole.ADMIN ||
    role === MemberRole.MODERATOR;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const headerButtonStyles = useCommunityHeaderStyle();

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const handleCreate = useCallback(() => {
    setShowPostForm((v) => !v);
  }, []);

  if (!board && isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-4 px-6 py-4">
          <div className="h-32 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
          <div className="h-32 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
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
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto scrollbar-chat"
      >
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div
            className="px-0 h-11 flex items-center"
            style={{
              ...headerButtonStyles,
              backgroundImage: "none",
              backgroundColor: "var(--theme-bg-quinary)",
            }}
          >
            <div className="ml-3 mr-3 flex w-full items-center gap-2">
              {/* Badge estilo chat-header */}
              <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 rounded-lg px-3 py-0.5">
                <MessageSquare className="h-6 w-6 shrink-0 text-theme-text-subtle" />
                <p className="min-w-0 truncate text-center text-[20px] font-semibold text-theme-text-subtle">
                  {board ? `Foro de ${board.name}` : "Foro"}
                </p>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-0 text-theme-text-subtle transition hover:bg-theme-app-settings-hover hover:text-theme-text-light focus-visible:outline-none disabled:opacity-50 md:w-auto md:px-3"
                  aria-label="Crear post"
                  title="Crear post"
                >
                  <Plus className="h-6 w-6" />
                  <span className="hidden md:inline">Crear post</span>
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-0 text-theme-text-subtle transition hover:bg-theme-app-settings-hover hover:text-theme-text-light focus-visible:outline-none disabled:opacity-50 md:w-auto md:px-3"
                  aria-label="Refrescar posts"
                  title="Refrescar posts"
                >
                  <RefreshCw
                    className={`h-6 w-6 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span className="hidden md:inline">Refrescar</span>
                </button>
              </div>
            </div>
          </div>
          {showPostForm && (
            <div
              style={{
                ...headerButtonStyles,
                backgroundImage: "none",
                backgroundColor: "transparent",
              }}
              className="py-2.5 px-3"
            >
              <InlineCommunityPostForm
                communityId={boardId}
                communityName={board?.name}
                onCancel={() => setShowPostForm(false)}
                onSuccess={() => setShowPostForm(false)}
              />
            </div>
          )}
        </div>

        {/* Posts feed */}
        <div className="w-full">
          <CommunityPostsSection
            communityId={boardId}
            isActive={true}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      </div>
    </div>
  );
}

export const ForumView = memo(ForumViewInner);
