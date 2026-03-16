import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Languages } from "@prisma/client";
import { mergeCommunityToFeedCache } from "../community-feed/use-communities-feed";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

// TYPES

export interface CommunityBoardFeedItem {
  id: string;
  name: string;
  description: string | null;
  imageAsset: ClientUploadedAsset | null;
  size: number;
  occupiedSlots: number;
  freeSlots: number;
  languages: Languages[];
  score: number;
}

export interface CommunityInfo {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  activeBoardsCount: number; // Real-time count from /boards endpoint
}

export interface BoardFeedPage {
  items: CommunityBoardFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  // Community metadata only present on first page (no cursor)
  community?: CommunityInfo;
}

/**
 * Represents a page slot in the virtualized feed.
 * Can be either rendered (with real content) or virtualized (placeholder).
 */
export type BoardPageSlot =
  | { type: "rendered"; pageIndex: number; page: BoardFeedPage }
  | { type: "virtualized"; pageIndex: number; height: number };

// CONSTANTS

const PAGE_SIZE = 3; // TODO: cambiar a 20 en producción
const ESTIMATED_BOARD_CARD_HEIGHT = 280; // Estimated height for board cards (variable due to descriptions)
const BOARD_CARD_GAP = 16; // Gap between cards (gap-4 = 16px)
const LRU_BUFFER = 6; // Number of pages to keep outside rendered window for LRU eviction

// Responsive column counts matching Tailwind breakpoints in community-boards-section.tsx
// grid-cols-1 (default) | md:grid-cols-2 (768px) | xl:grid-cols-3 (1280px)
const BREAKPOINT_MD = 768;
const BREAKPOINT_XL = 1280;

// Query key factory
export const communityBoardsKey = (communityId: string) =>
  ["community-boards-feed", communityId] as const;

// FETCH FUNCTION

async function fetchCommunityBoardsFeed(
  communityId: string,
  cursor?: string | null,
): Promise<BoardFeedPage> {
  const url = new URL(
    `/api/discovery/communities/${communityId}/boards`,
    window.location.origin,
  );
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error al cargar boards de la comunidad");
  return res.json();
}

// HOOK

interface UseCommunityBoardsFeedOptions {
  maxRenderedPages?: number;
  expandThreshold?: number;
  enabled?: boolean;
  externalContainerRef?: RefObject<HTMLDivElement | null>;
}

export function useCommunityBoardsFeed(
  communityId: string,
  {
    maxRenderedPages = 3,
    expandThreshold = 0.4,
    enabled = true,
    externalContainerRef,
  }: UseCommunityBoardsFeedOptions = {},
) {
  const queryClient = useQueryClient();

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalContainerRef ?? containerRef;

  // Track measured heights for each page (for variable height cards)
  const pageHeightsRef = useRef<Map<number, number>>(new Map());

  // Window state: index of first RENDERED page
  const [windowStart, setWindowStart] = useState(0);
  const [heightsVersion, setHeightsVersion] = useState(0);

  // REACT QUERY - Infinite Query for boards

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: communityBoardsKey(communityId),
    queryFn: ({ pageParam }) =>
      fetchCommunityBoardsFeed(communityId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 65, // 65s > cron interval (60s) to avoid redundant fetches
    enabled: enabled && !!communityId,
  });

  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);

  // Extract community info from first page (included only on first page)
  // This is memoized and updates when pages change (e.g., after refresh)
  const community = useMemo((): CommunityInfo | null => {
    if (pages.length === 0) return null;
    const firstPage = pages[0];
    return firstPage.community ?? null;
  }, [pages]);

  // Sync community info to the communities feed cache when we have data
  // This ensures the feed shows updated values when user navigates back
  useEffect(() => {
    if (!community) return;

    mergeCommunityToFeedCache(queryClient, {
      id: community.id,
      memberCount: community.memberCount,
      boardCount: community.activeBoardsCount,
    });
  }, [community, queryClient]);

  // DEDUPLICATED BOARDS (MOVED UP - needed for chunk calculations)

  // Flatten all items with deduplication FIRST
  // This is the source of truth for all boards to display
  const allBoards = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .flatMap((page) => page.items)
      .filter((board) => {
        if (seen.has(board.id)) return false;
        seen.add(board.id);
        return true;
      });
  }, [pages]);

  // Number of visual chunks based on deduplicated items
  const totalChunks = Math.ceil(allBoards.length / PAGE_SIZE);

  // HEIGHT MEASUREMENT (for variable height board cards with responsive grid)

  // Get current column count based on viewport width
  // Matches Tailwind: grid-cols-1 | md:grid-cols-2 | xl:grid-cols-3
  const getColumnCount = useCallback((): number => {
    if (typeof window === "undefined") return 1;
    const width = window.innerWidth;
    if (width >= BREAKPOINT_XL) return 3;
    if (width >= BREAKPOINT_MD) return 2;
    return 1;
  }, []);

  const getPageHeight = useCallback(
    (chunkIndex: number): number => {
      const measured = pageHeightsRef.current.get(chunkIndex);
      if (measured !== undefined) return measured;

      // Estimate based on chunk size and responsive column count
      const chunkStart = chunkIndex * PAGE_SIZE;
      const chunkEnd = Math.min(chunkStart + PAGE_SIZE, allBoards.length);
      const itemCount = chunkEnd - chunkStart;

      if (itemCount <= 0) {
        // Fallback for empty chunk
        const cols = getColumnCount();
        const rows = Math.ceil(PAGE_SIZE / cols);
        return (
          rows * ESTIMATED_BOARD_CARD_HEIGHT +
          Math.max(0, rows - 1) * BOARD_CARD_GAP
        );
      }

      // Calculate rows based on items and columns
      const cols = getColumnCount();
      const rows = Math.ceil(itemCount / cols);
      return (
        rows * ESTIMATED_BOARD_CARD_HEIGHT +
        Math.max(0, rows - 1) * BOARD_CARD_GAP
      );
    },
    [allBoards.length, getColumnCount],
  );

  const measurePage = useCallback(
    (pageIndex: number, element: HTMLElement | null) => {
      if (!element) return;

      const height = element.getBoundingClientRect().height;
      const currentHeight = pageHeightsRef.current.get(pageIndex);

      if (currentHeight === undefined || Math.abs(currentHeight - height) > 1) {
        pageHeightsRef.current.set(pageIndex, height);
        setHeightsVersion((v) => v + 1);
      }
    },
    [],
  );

  // LRU eviction: Remove heights far from the current window to prevent memory leak
  // Heights can be re-measured when pages are rendered again (cost: ~0.1ms per getBoundingClientRect)
  const evictDistantHeights = useCallback(
    (currentWindowStart: number) => {
      const minKeep = Math.max(0, currentWindowStart - LRU_BUFFER);
      const maxKeep = currentWindowStart + maxRenderedPages + LRU_BUFFER;

      pageHeightsRef.current.forEach((_, pageIndex) => {
        if (pageIndex < minKeep || pageIndex > maxKeep) {
          pageHeightsRef.current.delete(pageIndex);
        }
      });
    },
    [maxRenderedPages],
  );

  // CACHED PAGE POSITIONS

  const pagePositionsRef = useRef<{ start: number; end: number }[]>([]);

  const recalculatePositions = useCallback(() => {
    const positions: { start: number; end: number }[] = [];
    let accumulatedHeight = 0;

    for (let i = 0; i < totalChunks; i++) {
      const height = getPageHeight(i);
      positions.push({
        start: accumulatedHeight,
        end: accumulatedHeight + height,
      });
      accumulatedHeight += height;
    }

    pagePositionsRef.current = positions;
  }, [totalChunks, getPageHeight]);

  useEffect(() => {
    recalculatePositions();
  }, [heightsVersion, totalChunks, recalculatePositions]);

  // BINARY SEARCH - O(log N)

  const findPageAtPosition = useCallback((scrollTop: number): number => {
    const positions = pagePositionsRef.current;
    if (positions.length === 0) return 0;

    let low = 0;
    let high = positions.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (positions[mid].end <= scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }, []);

  // AUTO-CONTRACT WHEN NEW CHUNKS ARE AVAILABLE

  // Use ref to track previous totalChunks
  const prevTotalChunksRef = useRef(totalChunks);

  useEffect(() => {
    if (totalChunks !== prevTotalChunksRef.current) {
      prevTotalChunksRef.current = totalChunks;

      const renderedCount = totalChunks - windowStart;
      if (renderedCount > maxRenderedPages) {
        const newWindowStart = totalChunks - maxRenderedPages;
        setWindowStart(newWindowStart);
        // LRU: Clean up heights far from new window
        evictDistantHeights(newWindowStart);
      }
    }
  }, [totalChunks, windowStart, maxRenderedPages, evictDistantHeights]);

  // PAGE SLOTS CALCULATION (RE-CHUNKED FROM allBoards)

  // Re-chunk allBoards into visual pages of PAGE_SIZE
  // This ensures no visual gaps - each chunk (except last) has exactly PAGE_SIZE items
  const pageSlots = useMemo((): BoardPageSlot[] => {
    const slots: BoardPageSlot[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * PAGE_SIZE;
      const chunkEnd = Math.min(chunkStart + PAGE_SIZE, allBoards.length);
      const chunkItems = allBoards.slice(chunkStart, chunkEnd);

      if (i < windowStart) {
        // Virtualized chunk
        slots.push({
          type: "virtualized",
          pageIndex: i,
          height: getPageHeight(i),
        });
      } else {
        // Rendered chunk
        slots.push({
          type: "rendered",
          pageIndex: i,
          page: {
            items: chunkItems,
            nextCursor: null, // Not used for display
            hasMore: i < totalChunks - 1,
          },
        });
      }
    }

    return slots;
    // heightsVersion is intentionally included to trigger recalculation when heights are measured,
    // even though it's not directly used in the computation (it signals height changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalChunks, windowStart, allBoards, heightsVersion, getPageHeight]);

  // SCROLL HANDLER - O(log N)

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const positions = pagePositionsRef.current;
    if (!container || totalChunks === 0 || positions.length === 0) return;

    const scrollTop = container.scrollTop;

    const chunkAtViewportTop = findPageAtPosition(scrollTop);
    const firstRenderedChunk = windowStart;
    const renderedCount = totalChunks - windowStart;

    // --- EXPAND WINDOW ---
    if (windowStart > 0 && chunkAtViewportTop <= firstRenderedChunk) {
      const firstChunkPos = positions[firstRenderedChunk];
      const scrollIntoFirstChunk = scrollTop - firstChunkPos.start;
      const firstChunkHeight = firstChunkPos.end - firstChunkPos.start;
      const percentIntoFirstChunk = scrollIntoFirstChunk / firstChunkHeight;

      if (percentIntoFirstChunk < expandThreshold) {
        setWindowStart((prev) => Math.max(0, prev - 1));
        return;
      }
    }

    // --- CONTRACT WINDOW ---
    // Only contract if:
    // 1. We have more than maxRenderedPages rendered
    // 2. The user has scrolled at least 2 chunks past windowStart (hysteresis to prevent expand/contract loop)
    if (
      renderedCount > maxRenderedPages &&
      chunkAtViewportTop >= windowStart + 2
    ) {
      const newWindowStart = Math.min(
        windowStart + 1,
        totalChunks - maxRenderedPages,
      );
      setWindowStart(newWindowStart);
      // LRU: Clean up heights far from new window
      evictDistantHeights(newWindowStart);
    }
  }, [
    totalChunks,
    windowStart,
    maxRenderedPages,
    findPageAtPosition,
    expandThreshold,
    evictDistantHeights,
    scrollContainerRef,
  ]);

  // INTERSECTION OBSERVER

  // Flag to prevent consecutive fetches without user scroll
  // Requires sentinel to exit and re-enter viewport before fetching again
  const canFetchRef = useRef(true);

  useEffect(() => {
    const bottomSentinel = bottomSentinelRef.current;
    if (!bottomSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry.isIntersecting) {
          // Sentinel left viewport - allow next fetch
          canFetchRef.current = true;
          return;
        }

        // Sentinel is visible (bottom of viewport touched top of skeleton)
        if (hasNextPage && !isFetchingNextPage && canFetchRef.current) {
          canFetchRef.current = false; // Prevent consecutive fetches
          fetchNextPage();
        }
      },
      {
        root: scrollContainerRef.current,
        // rootMargin: 0 means trigger exactly when viewport bottom touches skeleton top
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(bottomSentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, scrollContainerRef]);

  // SCROLL EVENT LISTENER

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [handleScroll, scrollContainerRef]);

  // ACTIONS

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async () => {
    setWindowStart(0);
    pageHeightsRef.current.clear();
    setHeightsVersion(0);
    // Refetch all loaded pages to update data while keeping scroll position
    await refetch();
  }, [refetch]);

  // RETURN

  return {
    // Community info
    community,

    // Virtualization
    pageSlots,
    windowStart,

    // Data
    allBoards,
    totalChunks,

    // React Query state
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error?.message ?? null,

    // Actions
    loadMore,
    refresh,
    measurePage,

    // Refs
    containerRef: scrollContainerRef as React.RefObject<HTMLDivElement>,
    bottomSentinelRef: bottomSentinelRef as React.RefObject<HTMLDivElement>,
  };
}

export type CommunityBoardsFeed = ReturnType<typeof useCommunityBoardsFeed>;
