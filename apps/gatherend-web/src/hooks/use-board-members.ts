"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BoardMembersPage } from "@/hooks/board-cache";
import {
  BOARD_CACHE_GC_TIME_MS,
  BOARD_CACHE_STALE_TIME_MS,
  boardMembersQueryKey,
} from "@/hooks/board-cache";

export type BoardMembersPageSlot =
  | { type: "rendered"; pageIndex: number; page: BoardMembersPage }
  | { type: "virtualized"; pageIndex: number; height: number };

interface UseBoardMembersOptions {
  enabled?: boolean;
  limit?: number;
  maxRenderedPages?: number;
  rowHeight?: number;
  rowGap?: number;
  pageVerticalPadding?: number;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_RENDERED_PAGES = 4;
const DEFAULT_ROW_HEIGHT = 34;

async function fetchBoardMembersPage({
  boardId,
  cursor,
  limit,
}: {
  boardId: string;
  cursor?: string | null;
  limit: number;
}): Promise<BoardMembersPage> {
  const url = new URL(`/api/boards/${boardId}/members`, window.location.origin);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch board members");
  }

  return res.json();
}

export function useBoardMembers(
  boardId: string | undefined,
  {
    enabled = true,
    limit = DEFAULT_LIMIT,
    maxRenderedPages = DEFAULT_MAX_RENDERED_PAGES,
    rowHeight = DEFAULT_ROW_HEIGHT,
    rowGap = 0,
    pageVerticalPadding = 0,
  }: UseBoardMembersOptions = {},
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [windowState, setWindowState] = useState({
    boardId: boardId ?? "",
    windowStart: 0,
  });
  const [containerElement, setContainerElement] =
    useState<HTMLDivElement | null>(null);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerElement(node);
  }, []);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: boardMembersQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) =>
      fetchBoardMembersPage({
        boardId: boardId ?? "",
        cursor: pageParam,
        limit,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: enabled && Boolean(boardId),
    staleTime: BOARD_CACHE_STALE_TIME_MS,
    gcTime: BOARD_CACHE_GC_TIME_MS,
  });

  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const members = useMemo(
    () => pages.flatMap((page) => page.items),
    [pages],
  );
  const totalPages = pages.length;

  const getPageHeight = useCallback(
    (pageIndex: number) => {
      const page = pages[pageIndex];
      const itemCount = page?.items.length ?? limit;
      return (
        itemCount * rowHeight +
        Math.max(0, itemCount - 1) * rowGap +
        pageVerticalPadding
      );
    },
    [limit, pageVerticalPadding, pages, rowGap, rowHeight],
  );

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
    }

    return positions;
  }, [getPageHeight, totalPages]);

  const findPageAtPosition = useCallback(
    (scrollTop: number) => {
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

  const activeBoardId = boardId ?? "";
  const maxWindowStart = Math.max(0, totalPages - maxRenderedPages);
  const windowStart =
    windowState.boardId === activeBoardId
      ? Math.min(windowState.windowStart, maxWindowStart)
      : 0;
  const renderedWindowEnd = Math.min(totalPages, windowStart + maxRenderedPages);

  const pageSlots = useMemo((): BoardMembersPageSlot[] => {
    const slots: BoardMembersPageSlot[] = [];

    for (let i = 0; i < totalPages; i++) {
      if (i >= windowStart && i < renderedWindowEnd) {
        slots.push({ type: "rendered", pageIndex: i, page: pages[i] });
      } else {
        slots.push({
          type: "virtualized",
          pageIndex: i,
          height: getPageHeight(i),
        });
      }
    }

    return slots;
  }, [getPageHeight, pages, renderedWindowEnd, totalPages, windowStart]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || totalPages <= maxRenderedPages) return;

    const pageAtViewportTop = findPageAtPosition(container.scrollTop);
    let nextWindowStart = windowStart;

    if (pageAtViewportTop <= windowStart) {
      nextWindowStart = Math.max(0, pageAtViewportTop - 1);
    } else if (pageAtViewportTop >= windowStart + 2) {
      nextWindowStart = Math.min(maxWindowStart, pageAtViewportTop - 1);
    }

    if (nextWindowStart !== windowStart) {
      setWindowState({
        boardId: activeBoardId,
        windowStart: nextWindowStart,
      });
    }
  }, [
    activeBoardId,
    findPageAtPosition,
    maxRenderedPages,
    maxWindowStart,
    totalPages,
    windowStart,
  ]);

  useEffect(() => {
    if (!containerElement) return;

    containerElement.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => containerElement.removeEventListener("scroll", handleScroll);
  }, [containerElement, handleScroll]);

  useEffect(() => {
    if (!containerElement || !bottomSentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: containerElement, threshold: 0 },
    );

    observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [containerElement, fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    pages,
    members,
    pageSlots,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    refetch,
    error,
    containerRef: setContainerRef,
    bottomSentinelRef,
  };
}
