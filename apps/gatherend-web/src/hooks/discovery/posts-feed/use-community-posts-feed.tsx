import { useInfiniteQuery } from "@tanstack/react-query";
import type { JsonValue } from "@prisma/client/runtime/library";
import type {
  ClientProfileSummary,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { feedScrollStore } from "@/stores/feed-scroll-store";
import { useMeasuredPageObserver } from "@/hooks/use-measured-page-observer";

export interface CommunityPostAuthor
  extends Omit<ClientProfileSummary, "profileTags" | "usernameColor" | "usernameFormat"> {
  usernameColor: JsonValue | string | null;
  usernameFormat: JsonValue | string | null;
}

export interface CommunityPostFeedItem {
  id: string;
  title: string | null;
  content: string;
  imageAsset: ClientUploadedAsset | null;
  commentCount: number;
  latestComments: Array<{
    id: string;
    postId: string;
    content: string;
    deleted: boolean;
    imageAsset: ClientUploadedAsset | null;
    createdAt: string;
    updatedAt: string;
    author: CommunityPostAuthor;
    replyToCommentId: string | null;
    replyToComment: {
      id: string;
      content: string;
      deleted: boolean;
      createdAt: string;
      author: {
        id: string;
        username: string;
        discriminator: string | null;
      };
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: CommunityPostAuthor;
}

export interface CommunityPostsInfo {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  recentPostCount7d: number;
}

export interface CommunityPostsFeedPage {
  items: CommunityPostFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  community?: CommunityPostsInfo;
}

export type CommunityPostPageSlot =
  | { type: "rendered"; pageIndex: number; page: CommunityPostsFeedPage }
  | { type: "virtualized"; pageIndex: number; height: number };

const PAGE_SIZE = 10;
const ESTIMATED_POST_CARD_HEIGHT = 220;
const POST_CARD_GAP = 16;
const PAGE_GAP = 24;
const LRU_BUFFER = 6;

export const communityPostsKey = (communityId: string) =>
  ["community-posts-feed", communityId] as const;
export const communityPostsScrollKey = (communityId: string) =>
  `community:posts:${communityId}`;

async function fetchCommunityPostsFeed(
  communityId: string,
  cursor?: string | null,
): Promise<CommunityPostsFeedPage> {
  const url = new URL(
    `/api/discovery/communities/${communityId}/posts`,
    window.location.origin,
  );
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Error al cargar posts de la comunidad");
  return res.json();
}

interface UseCommunityPostsFeedOptions {
  maxRenderedPages?: number;
  expandThreshold?: number;
  enabled?: boolean;
  isActive?: boolean;
  externalContainerRef?: RefObject<HTMLDivElement | null>;
}

export function useCommunityPostsFeed(
  communityId: string,
  {
    maxRenderedPages = 3,
    expandThreshold = 0.4,
    enabled = true,
    isActive = true,
    externalContainerRef,
  }: UseCommunityPostsFeedOptions = {},
) {
  const scrollStateKey = communityPostsScrollKey(communityId);
  const initialScrollStateRef = useRef(feedScrollStore.get(scrollStateKey));
  const didRestoreScrollRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pagePositionsRef = useRef<{ start: number; end: number }[]>([]);
  const scrollContainerRef = externalContainerRef ?? containerRef;

  const [windowStart, setWindowStart] = useState(
    initialScrollStateRef.current.windowStart,
  );
  const [pageHeights, setPageHeights] = useState<Record<number, number>>(
    initialScrollStateRef.current.pageHeights,
  );
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkContainer = () => {
      const nextContainer = scrollContainerRef.current;
      if (nextContainer !== containerElement) {
        setContainerElement(nextContainer);
      }
    };

    checkContainer();
    const frameId = requestAnimationFrame(checkContainer);

    return () => cancelAnimationFrame(frameId);
  }, [containerElement, scrollContainerRef]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: communityPostsKey(communityId),
    queryFn: ({ pageParam }) => fetchCommunityPostsFeed(communityId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 30,
    enabled: enabled && isActive && !!communityId,
  });

  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const totalPages = pages.length;

  useEffect(() => {
    if (totalPages === 0) return;
    setWindowStart((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const community = useMemo((): CommunityPostsInfo | null => {
    if (pages.length === 0) return null;
    return pages[0].community ?? null;
  }, [pages]);

  const allPosts = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .flatMap((page) => page.items)
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
  }, [pages]);

  const getPageHeight = useCallback((pageIndex: number): number => {
    const measured = pageHeights[pageIndex];
    if (measured !== undefined) return measured;

    const page = pages[pageIndex];
    const itemCount = page?.items.length ?? PAGE_SIZE;

    return (
      itemCount * ESTIMATED_POST_CARD_HEIGHT +
      Math.max(0, itemCount - 1) * POST_CARD_GAP
    );
  }, [pageHeights, pages]);

  const measurePage = useCallback(
    (pageIndex: number, element: HTMLElement | null) => {
      if (!isActive) return;
      if (!element) return;

      const height = element.getBoundingClientRect().height;

      setPageHeights((prev) => {
        const currentHeight = prev[pageIndex];
        if (
          currentHeight !== undefined &&
          Math.abs(currentHeight - height) <= 1
        ) {
          return prev;
        }

        return { ...prev, [pageIndex]: height };
      });
    },
    [isActive],
  );
  const getMeasuredPageRef = useMeasuredPageObserver(measurePage);

  const evictDistantHeights = useCallback(
    (currentWindowStart: number) => {
      const minKeep = Math.max(0, currentWindowStart - LRU_BUFFER);
      const maxKeep = currentWindowStart + maxRenderedPages + LRU_BUFFER;

      setPageHeights((prev) => {
        let changed = false;
        const next: Record<number, number> = {};

        Object.entries(prev).forEach(([pageIndexKey, height]) => {
          const pageIndex = Number(pageIndexKey);
          if (pageIndex >= minKeep && pageIndex <= maxKeep) {
            next[pageIndex] = height;
          } else {
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    },
    [maxRenderedPages],
  );

  const recalculatePositions = useCallback(() => {
    const positions: { start: number; end: number }[] = [];
    let accumulatedHeight = 0;

    for (let i = 0; i < totalPages; i++) {
      const height = getPageHeight(i);
      positions.push({
        start: accumulatedHeight,
        end: accumulatedHeight + height,
      });
      accumulatedHeight += height;

      if (i < totalPages - 1) {
        accumulatedHeight += PAGE_GAP;
      }
    }

    pagePositionsRef.current = positions;
  }, [totalPages, getPageHeight]);

  useEffect(() => {
    recalculatePositions();
  }, [totalPages, recalculatePositions]);

  const persistScrollState = useCallback((options?: { force?: boolean }) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (!options?.force && !didRestoreScrollRef.current) return;

    const placeholderHeight = pagePositionsRef.current[windowStart]?.start ?? 0;
    feedScrollStore.set({
      key: scrollStateKey,
      windowStart,
      pageHeights,
      normalizedScrollTop: Math.max(0, container.scrollTop - placeholderHeight),
      updatedAt: Date.now(),
    });
  }, [pageHeights, scrollContainerRef, scrollStateKey, windowStart]);

  const persistScrollStateNow = useCallback(() => {
    persistScrollState({ force: true });
  }, [persistScrollState]);

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

  const prevTotalPagesRef = useRef(totalPages);

  useEffect(() => {
    if (totalPages !== prevTotalPagesRef.current) {
      prevTotalPagesRef.current = totalPages;

      const renderedCount = totalPages - windowStart;
      if (renderedCount > maxRenderedPages) {
        const newWindowStart = totalPages - maxRenderedPages;
        queueMicrotask(() => {
          setWindowStart(newWindowStart);
          evictDistantHeights(newWindowStart);
        });
      }
    }
  }, [totalPages, windowStart, maxRenderedPages, evictDistantHeights]);

  useEffect(() => {
    if (!isActive) return;
    const stored = feedScrollStore.get(scrollStateKey);
    didRestoreScrollRef.current = false;
    setWindowStart(stored.windowStart);
    setPageHeights(stored.pageHeights);
  }, [isActive, scrollStateKey]);

  const pageSlots = useMemo((): CommunityPostPageSlot[] => {
    const slots: CommunityPostPageSlot[] = [];

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

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const positions = pagePositionsRef.current;
    if (!container || totalPages === 0 || positions.length === 0) return;

    const scrollTop = container.scrollTop;
    const pageAtViewportTop = findPageAtPosition(scrollTop);
    const firstRenderedPage = windowStart;
    const renderedCount = totalPages - windowStart;

    if (windowStart > 0 && pageAtViewportTop <= firstRenderedPage) {
      const firstPagePos = positions[firstRenderedPage];
      const scrollIntoFirstPage = scrollTop - firstPagePos.start;
      const firstPageHeight = firstPagePos.end - firstPagePos.start;
      const percentIntoFirstPage = scrollIntoFirstPage / firstPageHeight;

      if (percentIntoFirstPage < expandThreshold) {
        setWindowStart((prev) => Math.max(0, prev - 1));
        return;
      }
    }

    if (
      renderedCount > maxRenderedPages &&
      pageAtViewportTop >= windowStart + 2
    ) {
      const newWindowStart = Math.min(
        windowStart + 1,
        totalPages - maxRenderedPages,
      );
      setWindowStart(newWindowStart);
      evictDistantHeights(newWindowStart);
    }
  }, [
    totalPages,
    windowStart,
    maxRenderedPages,
    findPageAtPosition,
    expandThreshold,
    evictDistantHeights,
    scrollContainerRef,
  ]);

  const canFetchRef = useRef(true);

  useEffect(() => {
    if (!isActive) return;
    const bottomSentinel = bottomSentinelRef.current;
    if (!bottomSentinel || !containerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry.isIntersecting) {
          canFetchRef.current = true;
          return;
        }

        if (hasNextPage && !isFetchingNextPage && canFetchRef.current) {
          canFetchRef.current = false;
          fetchNextPage();
        }
      },
      {
        root: containerElement,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(bottomSentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, containerElement, isActive]);

  useEffect(() => {
    if (!isActive) return;
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
  }, [handleScroll, containerElement, isActive, persistScrollState]);

  useEffect(() => {
    if (
      !isActive ||
      !containerElement ||
      totalPages === 0 ||
      didRestoreScrollRef.current
    ) {
      return;
    }

    const stored = feedScrollStore.get(scrollStateKey);
    const placeholderHeight = pagePositionsRef.current[windowStart]?.start ?? 0;
    const targetScrollTop = Math.max(
      0,
      stored.normalizedScrollTop + placeholderHeight,
    );

    requestAnimationFrame(() => {
      if (!containerElement) return;
      containerElement.scrollTop = targetScrollTop;
      didRestoreScrollRef.current = true;
    });
  }, [containerElement, isActive, scrollStateKey, totalPages, windowStart]);

  useEffect(() => {
    if (!isActive || !containerElement || totalPages === 0) return;
    persistScrollState();
  }, [
    containerElement,
    isActive,
    pageHeights,
    persistScrollState,
    totalPages,
    windowStart,
  ]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async () => {
    setWindowStart(0);
    setPageHeights({});
    await refetch();
  }, [refetch]);

  return {
    community,
    pageSlots,
    windowStart,
    allPosts,
    totalPages,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error?.message ?? null,
    loadMore,
    refresh,
    persistScrollState,
    persistScrollStateNow,
    measurePage,
    getMeasuredPageRef,
    containerRef: scrollContainerRef as React.RefObject<HTMLDivElement>,
    bottomSentinelRef: bottomSentinelRef as React.RefObject<HTMLDivElement>,
  };
}

export type CommunityPostsFeed = ReturnType<typeof useCommunityPostsFeed>;
