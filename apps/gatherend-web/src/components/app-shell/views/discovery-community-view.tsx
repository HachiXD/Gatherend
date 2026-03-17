"use client";

import {
  useCommunitiesFeed,
  PAGE_GAP,
} from "@/hooks/discovery/community-feed/use-communities-feed";
import { useCommunitiesSearch } from "@/hooks/discovery/use-communities-search";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { CommunityCard } from "@/components/discovery/community-card";
import { Search, X } from "lucide-react";
import { useBoardSwitchNavigation } from "@/contexts/board-switch-context";
import { memo, useCallback } from "react";

// Skeleton for initial loading — memoized
const CommunitiesSkeleton = memo(function CommunitiesSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 rounded-xl bg-theme-bg-primary border border-white/10 animate-pulse"
        >
          {/* Image skeleton */}
          <div className="w-24 h-24 rounded-lg bg-white/5 shrink-0" />
          {/* Content skeleton */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-6 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/5 rounded w-1/2" />
            <div className="flex gap-4 mt-auto">
              <div className="h-4 bg-white/5 rounded w-20" />
              <div className="h-4 bg-white/5 rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// Bottom skeleton for loading more
const FeedBottomSkeleton = memo(function FeedBottomSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 rounded-xl bg-theme-bg-primary border border-white/10 animate-pulse"
        >
          <div className="w-24 h-24 rounded-lg bg-white/5 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-6 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
});

// Skeleton for search results loading
const SearchSkeleton = memo(function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 rounded-xl bg-theme-bg-primary border border-white/10 animate-pulse"
        >
          <div className="w-24 h-24 rounded-lg bg-white/5 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-6 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const DiscoveryCommunityView = memo(function DiscoveryCommunityView() {
  const {
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    containerRef,
    bottomSentinelRef,
  } = useCommunitiesFeed();

  const { switchToCommunityPosts } = useBoardSwitchNavigation();

  // Hook para búsqueda server-side con debounce
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isLoading: isSearchLoading,
    error: searchError,
    hasNextPage: searchHasNextPage,
    loadMore: loadMoreSearch,
  } = useCommunitiesSearch();

  // When searching, show search results instead of virtualized feed
  const isSearching = searchQuery.trim().length > 0;

  // OPTIMIZACIÓN: Hook consolidado para infinite scroll de búsqueda
  const { scrollContainerRef: searchContainerRef } = useInfiniteScroll({
    onLoadMore: loadMoreSearch,
    hasNextPage: searchHasNextPage,
    isLoading: isSearchLoading,
    enabled: isSearching,
    threshold: 200,
  });

  // Callback estable para onExplore — evita recrear arrows en cada render
  const handleExplore = useCallback(
    (communityId: string) => {
      switchToCommunityPosts(communityId);
    },
    [switchToCommunityPosts],
  );

  return (
    <div
      ref={isSearching ? searchContainerRef : containerRef}
      className="h-full w-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-chat"
    >
      {/* Search bar */}
      <div className="relative mb-6 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar comunidades..."
          className="w-full pl-10 pr-10 py-2.5 bg-theme-bg-tertiary border border-theme-border rounded-lg text-theme-text-light placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-theme-border-accent-active-channel focus:border-theme-border-accent-active-channel transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-theme-bg-secondary transition-colors"
          >
            <X className="h-4 w-4 text-theme-text-muted" />
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && !isSearching ? (
        <CommunitiesSkeleton />
      ) : error && !isSearching ? (
        <div className="text-center py-8 text-destructive">Error: {error}</div>
      ) : isSearching ? (
        // Search results (server-side)
        isSearchLoading ? (
          <SearchSkeleton />
        ) : searchError ? (
          <div className="text-center py-8 text-destructive">
            Error: {searchError}
          </div>
        ) : searchResults.length > 0 ? (
          <div className="flex flex-col gap-6 pb-10">
            {searchResults.map((community) => (
              <CommunityCard
                key={community.id}
                id={community.id}
                name={community.name}
                imageAsset={community.imageAsset}
                memberCount={community.memberCount || 0}
                boardCount={community.boardCount || 0}
                recentPostCount7d={community.recentPostCount7d || 0}
                onExplore={() => handleExplore(community.id)}
              />
            ))}
            {/* Loading more indicator */}
            {isSearchLoading && searchResults.length > 0 && (
              <div className="py-4 text-center text-theme-text-muted">
                Cargando más...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-theme-text-muted">
            No se encontraron comunidades para &quot;{searchQuery}&quot;
          </div>
        )
      ) : (
        // Virtualized feed
        <>
          {pageSlots.map((slot, index) => {
            const isLast = index === pageSlots.length - 1;
            const marginBottom = isLast ? 0 : PAGE_GAP;

            if (slot.type === "virtualized") {
              // Placeholder for virtualized pages
              return (
                <div
                  key={`placeholder-${slot.pageIndex}`}
                  style={{ height: slot.height, marginBottom }}
                  className="shrink-0"
                />
              );
            }

            // Rendered page
            return (
              <div
                key={`page-${slot.pageIndex}`}
                style={{ marginBottom }}
                className="flex flex-col gap-6"
              >
                {slot.page.items.map((community) => (
                  <CommunityCard
                    key={community.id}
                    id={community.id}
                    name={community.name}
                    imageAsset={community.imageAsset}
                    memberCount={community.memberCount || 0}
                    boardCount={community.boardCount || 0}
                    recentPostCount7d={community.recentPostCount7d || 0}
                    onExplore={() => handleExplore(community.id)}
                  />
                ))}
              </div>
            );
          })}

          {/* Sentinel for infinite scroll - triggers when viewport bottom touches this point */}
          <div ref={bottomSentinelRef} className="h-1 shrink-0" />

          {/* Bottom skeleton for loading more */}
          {(isFetchingNextPage || hasNextPage) && <FeedBottomSkeleton />}
        </>
      )}
    </div>
  );
});
