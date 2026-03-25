"use client";

import {
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RefreshCw } from "lucide-react";
import { DiscoveryBoardCard } from "@/components/discovery/discovery-search-results/discovery-board-card";
import { DiscoverySkeleton } from "@/components/discovery/discovery-skeleton";
import { FeedBottomSkeleton } from "@/components/discovery/feed-bottom-skeleton";
import { useCommunityBoardsFeed } from "@/hooks/discovery/boards-feed/use-community-boards-feed";
import { useNewBoardsIndicator } from "@/hooks/discovery/use-new-boards-indicator";
import type { Languages } from "@prisma/client";

interface CommunityBoardsSectionProps {
  communityId: string;
  isActive: boolean;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onPersistScrollReady?: ((persist: () => void) => void) | undefined;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

function CommunityBoardsSectionInner({
  communityId,
  isActive,
  onHeaderActionChange,
  onPersistScrollReady,
  scrollContainerRef,
}: CommunityBoardsSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refresh,
    persistScrollStateNow,
    bottomSentinelRef,
    getMeasuredPageRef,
  } = useCommunityBoardsFeed(communityId, {
    isActive,
    externalContainerRef: scrollContainerRef,
  });

  const { hasNewBoards, clearIndicator } = useNewBoardsIndicator(communityId);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      clearIndicator();
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [clearIndicator, isRefreshing, refresh]);

  const headerAction = useMemo(
    () => (
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="relative inline-flex h-6.5 cursor-pointer items-center gap-2 border-0 bg-[var(--community-header-btn-bg)] px-3 text-[13px] font-semibold text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none disabled:opacity-50 rounded-none"
        title={hasNewBoards ? "Hay nuevos boards" : "Refrescar boards"}
      >
        <RefreshCw
          className={`h-4 w-4 text-[var(--community-header-btn-muted)] ${
            isRefreshing ? "animate-spin" : ""
          }`}
        />
        <span className="text-[var(--community-header-btn-text)]">Refrescar</span>
        {hasNewBoards && !isRefreshing && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>
    ),
    [handleRefresh, hasNewBoards, isRefreshing],
  );

  useEffect(() => {
    if (!isActive) return;
    onHeaderActionChange?.(headerAction);

    return () => onHeaderActionChange?.(null);
  }, [headerAction, isActive, onHeaderActionChange]);

  useEffect(() => {
    onPersistScrollReady?.(persistScrollStateNow);
  }, [onPersistScrollReady, persistScrollStateNow]);

  return (
    <div className="w-full">
      <div className="px-6 py-4">
        {isLoading ? (
          <DiscoverySkeleton />
        ) : error ? (
          <div className="py-8 text-center text-destructive">Error: {error}</div>
        ) : pageSlots.length === 0 ? (
          <div className="py-8 text-center text-theme-text-muted">
            No hay boards en esta comunidad.
          </div>
        ) : (
          <>
            {pageSlots.map((slot) => {
              if (slot.type === "virtualized") {
                return (
                  <div
                    key={`placeholder-${slot.pageIndex}`}
                    style={{ height: slot.height }}
                    className="shrink-0"
                  />
                );
              }

              return (
                <div
                  key={`page-${slot.pageIndex}`}
                  ref={getMeasuredPageRef(slot.pageIndex)}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                  {slot.page.items.map((board) => (
                    <DiscoveryBoardCard
                      key={board.id}
                      board={{
                        ...board,
                        languages: board.languages as Languages[],
                      }}
                    />
                  ))}
                </div>
              );
            })}

            <div ref={bottomSentinelRef} className="h-1 shrink-0" />

            {(isFetchingNextPage || hasNextPage) && <FeedBottomSkeleton />}
          </>
        )}
      </div>
    </div>
  );
}

export const CommunityBoardsSection = memo(CommunityBoardsSectionInner);
