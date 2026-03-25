import { useInfiniteQuery, QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
import { feedScrollStore } from "@/stores/feed-scroll-store";

// TYPES

export interface CommunityFeedItem {
  id: string;
  name: string;
  description: string | null;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  boardCount: number;
  recentPostCount7d: number;
}

export interface CommunityFeedPage {
  items: CommunityFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Represents a page slot in the virtualized feed.
 * Can be either rendered (with real content) or virtualized (placeholder).
 */
export type PageSlot =
  | { type: "rendered"; pageIndex: number; page: CommunityFeedPage }
  | { type: "virtualized"; pageIndex: number; height: number };

// CONSTANTS

export const COMMUNITIES_FEED_KEY = ["communities-feed"] as const;
export const COMMUNITIES_FEED_SCROLL_KEY = "discovery:communities-feed";
const PAGE_SIZE = 15; // TODO: cambiar a 20 en producción
// Card height: imagen h-30 (120px) + contenido inferior (~78px con padding y line-heights) = 198px
const COMMUNITY_CARD_HEIGHT = 198;
const COMMUNITY_CARD_GAP = 24; // Gap between cards (gap-6 = 24px)
export const PAGE_GAP = 32; // Gap between pages (mb-8 = 32px)

// FETCH FUNCTION

async function fetchCommunitiesFeed(
  cursor?: string | null,
): Promise<CommunityFeedPage> {
  const url = new URL("/api/discovery/communities", window.location.origin);
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error al cargar comunidades");
  return res.json();
}

// CACHE UTILITIES

/**
 * Merge updated community data into the feed cache.
 * Called when we get fresh data from a community detail view.
 */
export function mergeCommunityToFeedCache(
  queryClient: QueryClient,
  update: { id: string; memberCount?: number; boardCount?: number },
) {
  queryClient.setQueryData(
    COMMUNITIES_FEED_KEY,
    (
      old: { pages: CommunityFeedPage[]; pageParams: unknown[] } | undefined,
    ) => {
      if (!old) return old;

      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === update.id
              ? {
                  ...item,
                  memberCount: update.memberCount ?? item.memberCount,
                  boardCount: update.boardCount ?? item.boardCount,
                }
              : item,
          ),
        })),
      };
    },
  );
}

// HOOK

interface UseCommunitiesFeedOptions {
  maxRenderedPages?: number;
  expandThreshold?: number;
  enabled?: boolean;
}

export function useCommunitiesFeed({
  maxRenderedPages = 3,
  expandThreshold = 0.4,
  enabled = true,
}: UseCommunitiesFeedOptions = {}) {
  const scrollStateKey = COMMUNITIES_FEED_SCROLL_KEY;
  const initialScrollStateRef = useRef(feedScrollStore.get(scrollStateKey));
  const didRestoreScrollRef = useRef(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Window state: index of first RENDERED page
  const [windowStart, setWindowStart] = useState(
    initialScrollStateRef.current.windowStart,
  );

  // Ref mirror of windowStart — used inside scroll/persist callbacks
  // to avoid re-creating them on every windowStart change
  const windowStartRef = useRef(windowStart);
  windowStartRef.current = windowStart;

  // Track when container element changes (e.g., switching between search and feed)
  // This forces IntersectionObserver to re-create with correct root
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null);

  // Sync containerRef with containerElement state
  useEffect(() => {
    const checkContainer = () => {
      if (containerRef.current !== containerElement) {
        setContainerElement(containerRef.current);
      }
    };

    // Check immediately and on next frame (for ref assignment timing)
    checkContainer();
    const frameId = requestAnimationFrame(checkContainer);

    return () => cancelAnimationFrame(frameId);
  }, [containerElement]);

  // REACT QUERY - Infinite Query for data fetching

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: COMMUNITIES_FEED_KEY,
    queryFn: ({ pageParam }) => fetchCommunitiesFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 65, // 65s > cron interval (60s) to avoid redundant fetches
    enabled,
  });

  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const totalPages = pages.length;

  useEffect(() => {
    if (totalPages === 0) return;
    setWindowStart((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  // FIXED HEIGHT CALCULATIONS - O(1) since all cards have same height

  const getPageHeight = useCallback(
    (pageIndex: number): number => {
      const page = pages[pageIndex];
      if (!page)
        return (
          PAGE_SIZE * COMMUNITY_CARD_HEIGHT +
          (PAGE_SIZE - 1) * COMMUNITY_CARD_GAP
        );

      const itemCount = page.items.length;
      return (
        itemCount * COMMUNITY_CARD_HEIGHT +
        Math.max(0, itemCount - 1) * COMMUNITY_CARD_GAP
      );
    },
    [pages],
  );

  // Cached page positions - recalculated only when pages change
  const pagePositions = useMemo(() => {
    const positions: { start: number; end: number }[] = [];
    let accumulatedHeight = 0;

    for (let i = 0; i < totalPages; i++) {
      const height = getPageHeight(i);
      positions.push({
        start: accumulatedHeight,
        end: accumulatedHeight + height,
      });
      accumulatedHeight += height;
      // Add gap between pages (not after last page)
      if (i < totalPages - 1) {
        accumulatedHeight += PAGE_GAP;
      }
    }

    return positions;
  }, [totalPages, getPageHeight]);

  const persistScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = windowStartRef.current;
    const placeholderHeight = pagePositions[ws]?.start ?? 0;
    feedScrollStore.set({
      key: scrollStateKey,
      windowStart: ws,
      pageHeights: {},
      normalizedScrollTop: Math.max(0, container.scrollTop - placeholderHeight),
      updatedAt: Date.now(),
    });
  }, [pagePositions, scrollStateKey]);

  // O(1) position lookup using cached positions
  const getPagePosition = useCallback(
    (pageIndex: number): { start: number; end: number } => {
      if (pageIndex < 0 || pageIndex >= pagePositions.length) {
        // Fallback for out of bounds
        const height = getPageHeight(pageIndex);
        return { start: 0, end: height };
      }
      return pagePositions[pageIndex];
    },
    [pagePositions, getPageHeight],
  );

  // O(log N) binary search using cached positions
  const findPageAtPosition = useCallback(
    (scrollTop: number): number => {
      if (pagePositions.length === 0) return 0;

      let low = 0;
      let high = pagePositions.length - 1;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (pagePositions[mid].end <= scrollTop) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      return low;
    },
    [pagePositions],
  );

  // AUTO-CONTRACT WHEN NEW PAGES ARE FETCHED

  // Use ref to track previous totalPages
  const prevTotalPagesRef = useRef(totalPages);

  useEffect(() => {
    if (totalPages !== prevTotalPagesRef.current) {
      prevTotalPagesRef.current = totalPages;

      const renderedCount = totalPages - windowStart;
      if (renderedCount > maxRenderedPages) {
        const newWindowStart = totalPages - maxRenderedPages;
        queueMicrotask(() => {
          setWindowStart(newWindowStart);
        });
      }
    }
  }, [totalPages, windowStart, maxRenderedPages]);

  useEffect(() => {
    const stored = feedScrollStore.get(scrollStateKey);
    didRestoreScrollRef.current = false;
    setWindowStart(stored.windowStart);
  }, [scrollStateKey]);

  // PAGE SLOTS CALCULATION

  const pageSlots = useMemo((): PageSlot[] => {
    const slots: PageSlot[] = [];

    for (let i = 0; i < totalPages; i++) {
      if (i < windowStart) {
        slots.push({
          type: "virtualized",
          pageIndex: i,
          height: getPageHeight(i),
        });
      } else {
        slots.push({
          type: "rendered",
          pageIndex: i,
          page: pages[i],
        });
      }
    }

    return slots;
  }, [totalPages, windowStart, pages, getPageHeight]);

  // Flatten all items (for search, etc.)
  const allCommunities = useMemo(() => {
    return pages.flatMap((page) => page.items);
  }, [pages]);

  // SCROLL HANDLER

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || totalPages === 0) return;

    const scrollTop = container.scrollTop;
    const ws = windowStartRef.current;

    const pageAtViewportTop = findPageAtPosition(scrollTop);
    const firstRenderedPage = ws;
    const renderedCount = totalPages - ws;

    // --- EXPAND WINDOW (scroll up) ---
    if (ws > 0 && pageAtViewportTop <= firstRenderedPage) {
      const firstPagePos = getPagePosition(firstRenderedPage);
      const scrollIntoFirstPage = scrollTop - firstPagePos.start;
      const firstPageHeight = firstPagePos.end - firstPagePos.start;
      const percentIntoFirstPage = scrollIntoFirstPage / firstPageHeight;

      if (percentIntoFirstPage < expandThreshold) {
        setWindowStart((prev) => Math.max(0, prev - 1));
        return;
      }
    }

    // --- CONTRACT WINDOW (scroll down) ---
    // Only contract if:
    // 1. We have more than maxRenderedPages rendered
    // 2. The user has scrolled at least 2 pages past windowStart (hysteresis to prevent expand/contract loop)
    if (
      renderedCount > maxRenderedPages &&
      pageAtViewportTop >= ws + 2
    ) {
      setWindowStart((prev) =>
        Math.min(prev + 1, totalPages - maxRenderedPages),
      );
    }
  }, [
    totalPages,
    maxRenderedPages,
    findPageAtPosition,
    getPagePosition,
    expandThreshold,
  ]);

  // INTERSECTION OBSERVER - For loading more pages

  useEffect(() => {
    const bottomSentinel = bottomSentinelRef.current;
    // Wait for both sentinel AND container to be available
    if (!bottomSentinel || !containerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: containerElement, // Use tracked element, not ref.current
        // rootMargin: 0 means trigger exactly when viewport bottom touches skeleton top
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(bottomSentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, containerElement]);

  // SCROLL EVENT LISTENER

  useEffect(() => {
    if (!containerElement) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          persistScrollState();
          ticking = false;
        });
        ticking = true;
      }
    };

    containerElement.addEventListener("scroll", onScroll, { passive: true });
    return () => containerElement.removeEventListener("scroll", onScroll);
  }, [handleScroll, containerElement, persistScrollState]);

  useEffect(() => {
    if (!containerElement || totalPages === 0 || didRestoreScrollRef.current) {
      return;
    }

    const stored = feedScrollStore.get(scrollStateKey);
    const placeholderHeight = pagePositions[windowStart]?.start ?? 0;
    const targetScrollTop = Math.max(
      0,
      stored.normalizedScrollTop + placeholderHeight,
    );

    requestAnimationFrame(() => {
      if (!containerElement) return;
      containerElement.scrollTop = targetScrollTop;
      didRestoreScrollRef.current = true;
    });
  }, [containerElement, pagePositions, scrollStateKey, totalPages, windowStart]);

  useEffect(() => {
    if (!containerElement || totalPages === 0) return;
    persistScrollState();
  }, [containerElement, persistScrollState, totalPages, windowStart]);

  useEffect(() => {
    return () => {
      persistScrollState();
    };
  }, [persistScrollState]);

  // ACTIONS

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async () => {
    setWindowStart(0);
    await refetch();
  }, [refetch]);

  // RETURN

  return {
    // Virtualization
    pageSlots,
    windowStart,

    // Data
    allCommunities,
    totalPages,

    // React Query state
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error?.message ?? null,

    // Actions
    loadMore,
    refresh,

    // Refs to attach
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    bottomSentinelRef: bottomSentinelRef as React.RefObject<HTMLDivElement>,
  };
}
