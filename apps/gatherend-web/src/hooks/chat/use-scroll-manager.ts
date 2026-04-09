import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from "react";
import { logger } from "@/lib/logger";
import { chatScrollDimensionsStore } from "./chat-scroll-dimensions-store";

interface AnchorData {
  id: string;
  offsetFromAnchor: number;
  offsetType: "fromTop" | "fromBottom";
  direction: "top" | "bottom";
  offsetTop?: number;
  offsetHeight?: number;
  capturedElementHeight?: number;
  capturedScrollTop: number;
  capturedScrollHeight: number;
  capturedAt: number;
}

interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  distanceFromTop: number;
  distanceFromBottom: number;
}

interface PendingRestore {
  kind: "fetch" | "auto";
  direction: "top" | "bottom";
  armedScrollHeight: number;
  armedScrollTop: number;
  waitForScrollHeightDeltaPx?: number;
  cancelIfUserMovedPx?: number;
  armedAt: number;
}

interface CaptureOptions {
  kind?: "fetch" | "auto";
  preferExistingAnchor?: boolean;
  excludeMessageId?: string | null;
}

interface RestoreOptions {
  kind?: "fetch" | "auto";
  waitForScrollHeightDeltaPx?: number;
  cancelIfUserMovedPx?: number;
}

const USER_INPUT_WINDOW_MS = 160;
const PROGRAMMATIC_WRITE_WINDOW_MS = 80;
const POST_RESTORE_DIAG_WINDOW_MS = 320;
const POST_RESTORE_BUG_MIN_DELTA_PX = 8;
const POST_RESTORE_MIXED_MIN_DELTA_PX = 4;
// For a short window after applying a restore, suppress hover-driven media URL swaps (static <-> blob/animated)
// to reduce layout churn that can trigger browser scroll anchoring micro-adjustments (1–5px).
const POST_RESTORE_MEDIA_FREEZE_MS = POST_RESTORE_DIAG_WINDOW_MS + 120;
const ANCHOR_APPLY_EPSILON_PX = 1;
const AUTO_ANCHOR_IDLE_TIMEOUT_MS = 35;
const LOAD_PAUSE_MIN_SCROLL_HEIGHT_DELTA_PX = 100;

const FIX_ON_GEOMETRY_MAX_AGE_MS = 1500;
const FETCH_ANCHOR_MAX_EDGE_DISTANCE_MULTIPLIER = 0.75;
const TRIGGER_EDGE_BAND_PX = 100;
const COMPACT_REV_GATING_MAX_WAIT_MS = 350;

// Prefer-existing anchors are only safe while they're fresh and still near the
// edge we're paginating from. Otherwise we can reuse an offscreen anchor and
// restore to a wildly different scrollTop (the down→up jump bug).
const PREFER_EXISTING_ANCHOR_MAX_AGE_MS = 600;
const PREFER_EXISTING_ANCHOR_MAX_DISTANCE_MULTIPLIER = 1.5;

type PlaceholderState = {
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  placeholderHeightPx: number;
};

type ScrollManagerMessagesState = {
  channelId: string;
  ready: boolean;
  loadingMore: boolean;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  compactRevision?: number;
};

type TopVisibleSnapshot = {
  id: string | null;
  topOffset: number | null;
  height: number | null;
  compact: string | null;
  compactRevision: string | null;
};

type OverflowAnchorSnapshot = {
  container: string;
  content: string;
  topVisible: string;
  anchor: string;
};

type ScrollManagerMergeProps = {
  messages: ScrollManagerMessagesState;
  placeholderHeight: number;
  canLoadMore: boolean;
  canPaginateTop?: boolean;
  canPaginateBottom?: boolean;
  isFetchingTop?: boolean;
  isFetchingBottom?: boolean;
  loadMoreTop?: () => Promise<{ ok: boolean }>;
  loadMoreBottom?: () => Promise<{ ok: boolean }>;
};

type UseScrollManagerOptions = {
  dimensionsKey?: string;
  mergeProps?: ScrollManagerMergeProps;
  elementRefs?: {
    container?: MutableRefObject<HTMLDivElement | null>;
    content?: MutableRefObject<HTMLElement | null>;
  };
};

type PaginationState = {
  canLoadMore: boolean;
  // Whether the app *wants* pagination in each direction right now.
  canPaginateTop: boolean;
  canPaginateBottom: boolean;
  isFetchingTop: boolean;
  isFetchingBottom: boolean;
  loadMoreTop?: () => Promise<{ ok: boolean }>;
  loadMoreBottom?: () => Promise<{ ok: boolean }>;
  restoreWaitForScrollHeightDeltaPx: number;
  restoreCancelIfUserMovedPx: number;
  suppressAfterLoadMs: number;
  debounceMs: number;
};

type ScrollTransactionPhase = "idle" | "loading" | "restoring";

type ScrollTransactionState = {
  phase: ScrollTransactionPhase;
  direction: "top" | "bottom" | null;
  sequence: number;
  startedAt: number;
};

const FIXED_DT_SECONDS = 1 / 240;

class ScrollSpring {
  private tension: number;
  private friction: number;
  private threshold: number;
  private mass: number;
  private maxVelocity: number;
  private clamp: boolean;
  private callback: (value: number, abort: () => void) => void;
  private getNodeWindow: () => Window | null;

  private accumulator = 0;
  private from = 0;
  private target = 0;
  private vel = 0;
  private animating = false;
  private last: number | null = null;
  private nextTick = -1;
  private nodeWindow: Window | null = null;
  private callbacks: Array<() => void> = [];

  constructor(input: {
    callback: (value: number, abort: () => void) => void;
    tension?: number;
    friction?: number;
    mass?: number;
    threshold?: number;
    clamp?: boolean;
    maxVelocity?: number;
    getNodeWindow?: () => Window | null;
  }) {
    this.callback = input.callback;
    this.from = 0;
    this.tension = input.tension ?? 200;
    this.friction = input.friction ?? 35;
    this.mass = input.mass ?? 2;
    this.threshold = input.threshold ?? 0.001;
    this.clamp = input.clamp ?? true;
    this.maxVelocity = input.maxVelocity ?? Number.POSITIVE_INFINITY;
    this.getNodeWindow = input.getNodeWindow ?? (() => window);
  }

  to(input: {
    to: number;
    from?: number;
    animate?: boolean;
    callback?: () => void;
  }) {
    const { to, from, animate = false, callback } = input;
    this.target = to;
    if (callback) this.callbacks.push(callback);
    if (from != null) this.from = from;
    if (animate) {
      if (!this.animating) this.start();
      return this;
    }
    this.stop(to);
    return undefined;
  }

  mergeTo(input: { to: number; callback?: () => void }) {
    const { to, callback } = input;
    if (!this.animating) {
      if (callback) this.callbacks.push(callback);
      this.stop(to);
    }
    const delta = to - this.from;
    this.from = to;
    this.target = this.target + delta;
    this.callback(this.from, this.abort);
    if (callback) callback();
  }

  cancel() {
    this.stop(this.from);
    return this;
  }

  private abort = () => {
    this.animating = false;
  };

  private start() {
    this.animating = true;
    this.vel = 0;
    this.last = null;
    this.nodeWindow = this.getNodeWindow();
    this.nextTick = this.nodeWindow?.requestAnimationFrame(this.update) ?? -1;
  }

  private getUpdates(vel: number, from: number) {
    const accel =
      (-this.tension * (from - this.target) + -this.friction * vel) / this.mass;
    let nextVel = vel + accel * FIXED_DT_SECONDS;
    if (Math.abs(nextVel) > this.maxVelocity) {
      nextVel = this.maxVelocity * (nextVel > 0 ? 1 : -1);
    }
    const nextFrom = from + nextVel * FIXED_DT_SECONDS;
    return { from: nextFrom, vel: nextVel, accel };
  }

  private update = (timestamp: number) => {
    if (this.last == null) {
      this.last = timestamp;
      this.nextTick = this.nodeWindow?.requestAnimationFrame(this.update) ?? -1;
      return;
    }

    const now = timestamp;
    this.accumulator = Math.min((now - this.last) / 1000 + this.accumulator, 2);

    while (this.accumulator > FIXED_DT_SECONDS) {
      this.accumulator -= FIXED_DT_SECONDS;
      const { vel, from, accel } = this.getUpdates(this.vel, this.from);
      this.vel = vel;

      const clampedToTarget =
        this.clamp &&
        (from === this.target ||
          (from < this.target && this.from > this.target) ||
          (from > this.target && this.from < this.target));

      if (
        clampedToTarget ||
        Math.abs(accel * FIXED_DT_SECONDS) < this.threshold
      ) {
        this.stop(this.target);
        return;
      }

      this.from = from;
    }

    let interpolatedFrom = this.from;
    if (this.accumulator > 0) {
      const { from } = this.getUpdates(this.vel, interpolatedFrom);
      const delta =
        (from - interpolatedFrom) * (this.accumulator / FIXED_DT_SECONDS);
      interpolatedFrom += delta;
    }

    this.callback(interpolatedFrom, this.abort);

    if (this.animating) {
      this.last = now;
      this.nextTick = this.nodeWindow?.requestAnimationFrame(this.update) ?? -1;
    }
  };

  private stop(value?: number) {
    this.nodeWindow?.cancelAnimationFrame(this.nextTick);
    this.animating = false;
    this.accumulator = 0;
    if (value != null) {
      this.target = this.from = value;
      this.callback(value, this.abort);
    }
    if (this.callbacks.length > 0) {
      this.callbacks.forEach((cb) => cb());
      this.callbacks = [];
    }
  }
}

export function useScrollManager(
  container: HTMLDivElement | null,
  content?: HTMLElement | null,
  options?: UseScrollManagerOptions,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const dimensionsKeyRef = useRef<string | null>(
    options?.dimensionsKey ?? null,
  );
  const pinnedRef = useRef(false);

  useLayoutEffect(() => {
    const resolvedContainer =
      container ?? options?.elementRefs?.container?.current ?? null;
    const resolvedContent =
      content ?? options?.elementRefs?.content?.current ?? resolvedContainer;

    containerRef.current = resolvedContainer;
    contentRef.current = resolvedContent;
    dimensionsKeyRef.current = options?.dimensionsKey ?? null;
  }, [
    container,
    content,
    options?.dimensionsKey,
    options?.mergeProps?.messages.ready,
  ]);

  const automaticAnchorRef = useRef<AnchorData | null>(null);
  const messageFetchAnchorRef = useRef<AnchorData | null>(null);
  const fetchAnchorLiveUntilRef = useRef<number>(0);

  const pendingRestoreRef = useRef<PendingRestore | null>(null);
  const suppressUntilRef = useRef<number>(0);
  const automaticAnchorTimeoutRef = useRef<number | null>(null);
  const scrollCounterRef = useRef<number>(0);
  const loadMorePausedUntilUserScrollRef = useRef<boolean>(false);
  const scrollTopCacheRef = useRef<number | null>(null);
  const offsetHeightCacheRef = useRef<number | null>(null);
  const scrollHeightCacheRef = useRef<number | null>(null);

  const lastUserInputAtRef = useRef<number>(0);
  const lastProgrammaticWriteAtRef = useRef<number>(0);
  const lastProgrammaticWriteReasonRef = useRef<string>("none");

  const lastSeenScrollHeightRef = useRef<number | null>(null);
  const lastSeenClientHeightRef = useRef<number | null>(null);

  const transactionRef = useRef<ScrollTransactionState>({
    phase: "idle",
    direction: null,
    sequence: 0,
    startedAt: 0,
  });

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeFixInProgressRef = useRef(false);

  const placeholderStateRef = useRef<PlaceholderState>({
    hasMoreBefore: false,
    hasMoreAfter: false,
    placeholderHeightPx: 0,
  });
  const prevScrollTopForSpeedRef = useRef<number | null>(null);

  const paginationStateRef = useRef<PaginationState>({
    canLoadMore: true,
    canPaginateTop: false,
    canPaginateBottom: false,
    isFetchingTop: false,
    isFetchingBottom: false,
    loadMoreTop: undefined,
    loadMoreBottom: undefined,
    restoreWaitForScrollHeightDeltaPx: 120,
    restoreCancelIfUserMovedPx: 160,
    suppressAfterLoadMs: 80,
    debounceMs: 150,
  });

  const interactionStateRef = useRef<{
    isDragging: boolean;
    isScrollLoadingDisabled: boolean;
    disabledReason: string | null;
  }>({
    isDragging: false,
    isScrollLoadingDisabled: false,
    disabledReason: null,
  });

  const loadingRef = useRef(false);
  const propsRef = useRef<ScrollManagerMergeProps | null>(
    options?.mergeProps ?? null,
  );
  const initialScrollTopRef = useRef<number | null | undefined>(undefined);
  const scrollHeightBeforeLoadRef = useRef<number>(0);
  const lastLoadAtRef = useRef<number>(0);
  const handleScrollRef = useRef<((event?: Event) => void) | null>(null);
  const dragReleaseRecheckRafRef = useRef<number | null>(null);
  const mergePrevRef = useRef<{
    loadingMore: boolean;
    dimensionsKey: string | null;
  }>({
    loadingMore: false,
    dimensionsKey: null,
  });

  const updateDimensionsDebounceRef = useRef<number | null>(null);
  const pendingDimensionCallbacksRef = useRef<Array<() => void>>([]);
  const applyPendingRestoreRef = useRef<(() => void) | null>(null);
  const pendingRestoreSettleRafRef = useRef<number | null>(null);
  const pendingRestoreSettleReadyRef = useRef<boolean>(false);
  const pendingRestoreSettlingRevisionRef = useRef<number | null>(null);

  const springRef = useRef<ScrollSpring | null>(null);
  if (springRef.current == null) {
    springRef.current = new ScrollSpring({
      tension: 200,
      friction: 35,
      mass: 2,
      clamp: true,
      callback: (value, abort) => {
        const el = containerRef.current;
        if (!el) return abort();
        el.scrollTop = value;
        // Keep caches consistent even if this write doesn't dispatch a scroll event.
        scrollTopCacheRef.current = el.scrollTop;
        prevScrollTopForSpeedRef.current = el.scrollTop;
      },
      getNodeWindow: () =>
        containerRef.current?.ownerDocument?.defaultView ?? null,
    });
  }

  useEffect(() => {
    return () => {
      springRef.current?.cancel();
      if (automaticAnchorTimeoutRef.current != null) {
        window.clearTimeout(automaticAnchorTimeoutRef.current);
        automaticAnchorTimeoutRef.current = null;
      }
      if (updateDimensionsDebounceRef.current != null) {
        window.clearTimeout(updateDimensionsDebounceRef.current);
        updateDimensionsDebounceRef.current = null;
      }
      if (pendingRestoreSettleRafRef.current != null) {
        window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
        pendingRestoreSettleRafRef.current = null;
      }
    };
  }, []);

  const markUserInput = useCallback(() => {
    lastUserInputAtRef.current = Date.now();
  }, []);

  const markProgrammaticWrite = useCallback((reason: string) => {
    lastProgrammaticWriteAtRef.current = Date.now();
    lastProgrammaticWriteReasonRef.current = reason;
  }, []);

  const setScrollLoadingDisabled = useCallback(
    (disabled: boolean, reason?: string) => {
      interactionStateRef.current.isScrollLoadingDisabled = disabled;
      interactionStateRef.current.disabledReason = disabled
        ? (reason ?? "disabled")
        : null;
    },
    [],
  );

  const setDragging = useCallback((dragging: boolean) => {
    interactionStateRef.current.isDragging = dragging;
  }, []);

  const setPinned = useCallback((pinned: boolean) => {
    pinnedRef.current = pinned;
  }, []);

  const isActivelyScrolling = useCallback(() => {
    return scrollCounterRef.current >= 5;
  }, []);

  const isHeightChange = useCallback(
    (clientHeight: number, scrollHeight: number) => {
      return (
        clientHeight !== offsetHeightCacheRef.current ||
        scrollHeight !== scrollHeightCacheRef.current
      );
    },
    [],
  );

  const clearAutomaticAnchor = useCallback(() => {
    automaticAnchorRef.current = null;
  }, []);

  const beginScrollTransaction = useCallback((direction: "top" | "bottom") => {
    const current = transactionRef.current;
    if (current.phase !== "idle") {
      return false;
    }

    const sequence = current.sequence + 1;
    transactionRef.current = {
      phase: "loading",
      direction,
      sequence,
      startedAt: Date.now(),
    };

    return true;
  }, []);

  const transitionScrollTransaction = useCallback(
    (phase: Exclude<ScrollTransactionPhase, "idle">) => {
      const current = transactionRef.current;
      if (current.phase === "idle") return;
      if (current.phase === phase) return;

      transactionRef.current = {
        ...current,
        phase,
      };
    },
    [],
  );

  const completeScrollTransaction = useCallback((reason: string) => {
    const current = transactionRef.current;
    if (current.phase === "idle") return;

    transactionRef.current = {
      phase: "idle",
      direction: null,
      sequence: current.sequence,
      startedAt: 0,
    };

    const loading =
      loadingRef.current ||
      paginationStateRef.current.isFetchingTop ||
      paginationStateRef.current.isFetchingBottom;
    const hasPendingRestore = pendingRestoreRef.current != null;
    const now = Date.now();
    const fetchHot =
      messageFetchAnchorRef.current != null &&
      now <= fetchAnchorLiveUntilRef.current;
    if (
      !loading &&
      !hasPendingRestore &&
      messageFetchAnchorRef.current != null &&
      !fetchHot
    ) {
      messageFetchAnchorRef.current = null;
    }
  }, []);

  const setAutomaticAnchor = useCallback((anchor: AnchorData | null) => {
    automaticAnchorRef.current = anchor;
  }, []);

  const setPlaceholderState = useCallback((next: PlaceholderState) => {
    placeholderStateRef.current = next;
  }, []);

  const setPaginationState = useCallback((next: Partial<PaginationState>) => {
    paginationStateRef.current = {
      ...paginationStateRef.current,
      ...next,
    };
  }, []);

  const reportMessageLayoutCommit = useCallback(
    (_messageId: string, _isCompact: boolean) => {},
    [],
  );

  const getScrollPosition = useCallback((): ScrollPosition | null => {
    const el = containerRef.current;
    if (!el) return null;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    const clampedScrollTop = Math.min(maxScrollTop, Math.max(0, scrollTop));
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromTop: clampedScrollTop,
      distanceFromBottom: Math.max(0, maxScrollTop - clampedScrollTop),
    };
  }, []);

  const logScrollWrite = useCallback(
    (
      reason: string,
      from: number,
      to: number,
      extra?: Record<string, unknown>,
    ) => {
      const tx = transactionRef.current;
    },
    [],
  );

  const isScrolledToBottom = useCallback((pos: ScrollPosition) => {
    return (
      pos.scrollTop >= pos.scrollHeight - pos.clientHeight - 2 &&
      !placeholderStateRef.current.hasMoreAfter
    );
  }, []);

  const isScrollLoadingDisabled = useCallback(() => {
    const state = paginationStateRef.current;
    return (
      loadMorePausedUntilUserScrollRef.current ||
      loadingRef.current ||
      interactionStateRef.current.isDragging ||
      interactionStateRef.current.isScrollLoadingDisabled ||
      !state.canLoadMore
    );
  }, []);

  const getMessageElements = useCallback((): HTMLElement[] => {
    const root = contentRef.current ?? containerRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-message-id]"));
  }, []);

  const getTopVisibleSnapshot = useCallback((): TopVisibleSnapshot | null => {
    const containerEl = containerRef.current;
    if (!containerEl) return null;
    const elements = getMessageElements();
    if (elements.length === 0) {
      return {
        id: null,
        topOffset: null,
        height: null,
        compact: null,
        compactRevision: null,
      };
    }

    const containerRect = containerEl.getBoundingClientRect();
    const topEdge = containerRect.top;
    const picked =
      elements.find((el) => el.getBoundingClientRect().bottom > topEdge + 1) ??
      elements[0];
    const rect = picked.getBoundingClientRect();

    return {
      id: picked.getAttribute("data-message-id"),
      topOffset: rect.top - topEdge,
      height: rect.height,
      compact: picked.dataset.messageCompact ?? null,
      compactRevision: picked.dataset.compactRevision ?? null,
    };
  }, [getMessageElements]);

  const getViewportSnapshot = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return null;

    const elements = getMessageElements();
    if (elements.length === 0) {
      return {
        top: getTopVisibleSnapshot(),
        center: null,
        bottom: null,
        visibleCount: 0,
        visibleSample: [] as Array<string>,
      };
    }

    const containerRect = containerEl.getBoundingClientRect();
    const topEdge = containerRect.top;
    const bottomEdge = containerRect.bottom;
    const centerY = topEdge + containerRect.height / 2;

    let top: TopVisibleSnapshot | null = null;
    let center: TopVisibleSnapshot | null = null;
    let bottom: TopVisibleSnapshot | null = null;
    let visibleCount = 0;
    const visibleSample: Array<string> = [];

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.bottom > topEdge + 1 && rect.top < bottomEdge - 1;
      if (!isVisible) continue;

      visibleCount += 1;
      const snap: TopVisibleSnapshot = {
        id: el.getAttribute("data-message-id"),
        topOffset: rect.top - topEdge,
        height: rect.height,
        compact: el.dataset.messageCompact ?? null,
        compactRevision: el.dataset.compactRevision ?? null,
      };

      if (top == null) top = snap;
      bottom = snap;
      if (center == null && rect.top <= centerY && rect.bottom >= centerY) {
        center = snap;
      }

      if (visibleSample.length < 5) {
        const id = snap.id ?? "none";
        const off = snap.topOffset ?? NaN;
        const h = snap.height ?? NaN;
        visibleSample.push(`${id}@${off.toFixed(1)}h${h.toFixed(0)}`);
      }
    }

    return {
      top: top ?? getTopVisibleSnapshot(),
      center,
      bottom,
      visibleCount,
      visibleSample,
    };
  }, [getMessageElements, getTopVisibleSnapshot]);

  const getMessageElementById = useCallback(
    (id: string): HTMLElement | null => {
      const root = contentRef.current ?? containerRef.current;
      if (!root) return null;
      const direct =
        (root.querySelector(
          `:scope > [data-message-id="${id}"]`,
        ) as HTMLElement | null) ??
        (root.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null);
      return direct;
    },
    [],
  );

  const readAnchorOffset = useCallback(
    (
      messageEl: HTMLElement,
      direction: "top" | "bottom",
      containerEl: HTMLDivElement,
    ): {
      offsetFromTop: number;
      offsetFromBottom: number;
      edgeDistance: number;
    } => {
      const rect = messageEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const offsetFromTop = rect.top - containerRect.top;
      const offsetFromBottom = containerRect.bottom - rect.bottom;
      const edgeDistance =
        direction === "bottom"
          ? Math.abs(offsetFromBottom)
          : Math.abs(offsetFromTop);
      return { offsetFromTop, offsetFromBottom, edgeDistance };
    },
    [],
  );

  const getOffsetFromNodeToContainer = useCallback(
    (node: HTMLElement, containerEl: HTMLElement): number => {
      let offset = node.offsetTop;
      let parent = node.offsetParent as HTMLElement | null;
      while (parent != null && parent !== containerEl) {
        offset += parent.offsetTop;
        parent = parent.offsetParent as HTMLElement | null;
      }
      // If `containerEl` is not in the node's `offsetParent` chain (common when the
      // scroller itself isn't a positioned element), the above loop cannot produce a
      // container-relative offset. Fall back to a rect-based computation that matches
      // the coordinate system used by `fixWithAnchor` / `getBoundingClientRect()`.
      //
      // We want an "offsetTop within the scroll content" so that:
      //   offsetFromTop = offsetTop - scrollTop === (rect.top - containerRect.top)
      if (parent == null) {
        const rect = node.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();
        return containerEl.scrollTop + (rect.top - containerRect.top);
      }
      return offset;
    },
    [],
  );

  const setAnchor = useCallback(
    (
      kind: "fetch" | "auto",
      next: Omit<AnchorData, "capturedScrollTop" | "capturedScrollHeight"> & {
        capturedScrollTop?: number;
        capturedScrollHeight?: number;
      },
      pos: ScrollPosition,
    ) => {
      const data: AnchorData = {
        id: next.id,
        offsetFromAnchor: next.offsetFromAnchor,
        offsetType: next.offsetType,
        direction: next.direction,
        offsetTop: next.offsetTop,
        offsetHeight: next.offsetHeight,
        capturedScrollTop: next.capturedScrollTop ?? pos.scrollTop,
        capturedScrollHeight: next.capturedScrollHeight ?? pos.scrollHeight,
        capturedAt: next.capturedAt,
      };
      if (kind === "fetch") {
        messageFetchAnchorRef.current = data;
        fetchAnchorLiveUntilRef.current =
          Date.now() + FIX_ON_GEOMETRY_MAX_AGE_MS;
      } else {
        automaticAnchorRef.current = data;
      }
    },
    [],
  );

  const getAnchorData = useCallback(
    (
      id: string,
      scrollTop: number,
      clampToClientHeight?: number,
    ): AnchorData | null => {
      const containerEl = containerRef.current;
      if (!containerEl) return null;
      const pos = getScrollPosition();
      if (!pos) return null;

      const messageEl = getMessageElementById(id);
      if (!messageEl) return null;

      const offsetTop = getOffsetFromNodeToContainer(messageEl, containerEl);
      let offsetFromTop = offsetTop - scrollTop;
      if (clampToClientHeight != null) {
        offsetFromTop = Math.max(
          -messageEl.offsetHeight,
          Math.min(clampToClientHeight, offsetFromTop),
        );
      }

      return {
        id,
        offsetFromAnchor: offsetFromTop,
        offsetType: "fromTop",
        direction: "top",
        offsetTop,
        offsetHeight: messageEl.offsetHeight,
        capturedElementHeight: messageEl.offsetHeight,
        capturedScrollTop: pos.scrollTop,
        capturedScrollHeight: pos.scrollHeight,
        capturedAt: Date.now(),
      };
    },
    [getMessageElementById, getOffsetFromNodeToContainer, getScrollPosition],
  );

  const findFetchAnchor = useCallback(
    (isAfter: boolean): AnchorData | null => {
      const containerEl = containerRef.current;
      if (!containerEl) return null;
      const pos = getScrollPosition();
      if (!pos) return null;
      const messages = getMessageElements();
      if (messages.length === 0) return null;
      const direction: "top" | "bottom" = isAfter ? "bottom" : "top";

      const viewportTop = pos.scrollTop;
      const viewportBottom = pos.scrollTop + pos.clientHeight;
      const maxEdgeDistancePx =
        pos.clientHeight * FETCH_ANCHOR_MAX_EDGE_DISTANCE_MULTIPLIER;

      const start = isAfter ? messages.length - 1 : 0;
      const step = isAfter ? -1 : 1;

      let fallback: { anchor: AnchorData; index: number } | null = null;

      for (
        let index = start;
        index >= 0 && index < messages.length;
        index += step
      ) {
        const messageEl = messages[index];
        const messageId = messageEl.getAttribute("data-message-id");
        if (!messageId) continue;

        const anchorData = getAnchorData(messageId, pos.scrollTop);
        if (!anchorData) continue;

        if (!fallback) {
          fallback = { anchor: anchorData, index };
        }

        const anchorTop = anchorData.offsetTop ?? 0;
        const anchorHeight = anchorData.offsetHeight ?? 0;
        const anchorBottom = anchorTop + anchorHeight;
        const intersectsViewport =
          anchorBottom > viewportTop && anchorTop < viewportBottom;
        const edgeDistance =
          direction === "bottom"
            ? Math.abs(anchorTop - viewportBottom)
            : Math.abs(anchorBottom - viewportTop);

        if (!intersectsViewport && edgeDistance > maxEdgeDistancePx) {
          continue;
        }

        return {
          ...anchorData,
          direction,
        };
      }

      if (fallback) {
        return {
          ...fallback.anchor,
          direction,
        };
      }

      return null;
    },
    [getAnchorData, getMessageElements, getScrollPosition],
  );

  const findAnchor = useCallback((): AnchorData | null => {
    const pos = getScrollPosition();
    if (!pos) return null;

    const messages = getMessageElements();
    if (messages.length === 0) return null;

    const buffer = 0;

    let candidate: AnchorData | null = null;
    let started = false;
    for (const messageEl of messages) {
      const id = messageEl.getAttribute("data-message-id");
      if (!id) continue;
      const data = getAnchorData(id, pos.scrollTop);
      if (!data) continue;

      if (
        started &&
        (data.offsetTop ?? 0) > pos.scrollTop + buffer + pos.clientHeight
      ) {
        break;
      }

      if (
        !started &&
        ((data.offsetTop ?? 0) >= pos.scrollTop + buffer ||
          messageEl === messages[messages.length - 1])
      ) {
        candidate = data;
        started = true;
      }
    }

    return candidate;
  }, [getAnchorData, getMessageElements, getScrollPosition]);

  const updateFetchAnchor = useCallback(
    (scrollTop: number, clientHeight: number, scrollHeight: number) => {
      const current = messageFetchAnchorRef.current;
      if (!current) return;
      const { hasMoreBefore, hasMoreAfter, placeholderHeightPx } =
        placeholderStateRef.current;
      const inTopRegion =
        hasMoreBefore &&
        scrollTop < placeholderHeightPx &&
        scrollHeight > clientHeight;
      const inBottomRegion =
        hasMoreAfter &&
        scrollTop >= scrollHeight - clientHeight - placeholderHeightPx;
      const region = inTopRegion || inBottomRegion ? 1 : 0;
      const next = getAnchorData(
        current.id,
        scrollTop,
        region > 0 ? clientHeight : undefined,
      );
      // Never let viewport/placeholder clamping rewrite the desired restore offset.
      // The fetch anchor's `offsetFromAnchor` is the invariant we intend to restore
      // to; if we update it here (especially when clamped to `clientHeight`), the
      // subsequent restore can "snap" the anchor to the bottom of the viewport and
      // look like a jump downward.
      //
      // Still refresh geometry (offsetTop/height/captured*) when available, but
      // preserve the stored desired offset and direction/offsetType.
      if (!next) return;
      next.offsetFromAnchor = current.offsetFromAnchor;
      next.offsetType = current.offsetType;
      next.direction = current.direction;
      messageFetchAnchorRef.current = next;
    },
    [getAnchorData],
  );

  const updateAutomaticAnchor = useCallback(
    (scrollTop: number, keepOffset = false) => {
      const current = automaticAnchorRef.current;
      if (!current) return;

      const next = getAnchorData(current.id, scrollTop);
      if (!next) {
        setAutomaticAnchor(null);
        return;
      }

      if (keepOffset) {
        next.offsetFromAnchor = current.offsetFromAnchor;
      }
      setAutomaticAnchor(next);
    },
    [getAnchorData, setAutomaticAnchor],
  );

  const hasAnchor = useCallback(() => {
    return (
      messageFetchAnchorRef.current != null ||
      automaticAnchorRef.current != null
    );
  }, []);

  const getAnchorFixData = useCallback(() => {
    const loading =
      loadingRef.current ||
      paginationStateRef.current.isFetchingTop ||
      paginationStateRef.current.isFetchingBottom;

    for (const anchor of [
      loading ? null : messageFetchAnchorRef.current,
      automaticAnchorRef.current,
    ]) {
      if (!anchor) continue;

      const node = getMessageElementById(anchor.id);
      if (!node) continue;

      const containerEl = containerRef.current;
      if (!containerEl) continue;

      const nodeOffsetTop = getOffsetFromNodeToContainer(node, containerEl);

      const heightAdjustment =
        anchor === messageFetchAnchorRef.current
          ? (anchor.offsetHeight ?? node.offsetHeight) - node.offsetHeight
          : 0;

      return {
        node,
        fixedScrollTop:
          nodeOffsetTop - (anchor.offsetFromAnchor + heightAdjustment),
      };
    }

    return null;
  }, [getMessageElementById, getOffsetFromNodeToContainer]);

  const isInPlaceholderRegion = useCallback(
    (pos: ScrollPosition): 0 | 1 | 2 => {
      const { hasMoreBefore, hasMoreAfter, placeholderHeightPx } =
        placeholderStateRef.current;
      if (placeholderHeightPx <= 0) return 0;
      if (
        hasMoreBefore &&
        pos.scrollTop < placeholderHeightPx &&
        pos.scrollHeight > pos.clientHeight
      ) {
        return 1;
      }
      if (
        hasMoreAfter &&
        pos.scrollTop >=
          pos.scrollHeight - pos.clientHeight - placeholderHeightPx
      ) {
        return 2;
      }
      return 0;
    },
    [],
  );

  const capture = useCallback(
    (direction: "top" | "bottom", options?: CaptureOptions) => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const pos = getScrollPosition();
      if (!pos) return;

      const kind: "fetch" | "auto" = options?.kind ?? "auto";
      const existing =
        kind === "fetch"
          ? messageFetchAnchorRef.current
          : automaticAnchorRef.current;

      if (
        options?.preferExistingAnchor &&
        existing?.id &&
        existing.direction === direction &&
        (!options?.excludeMessageId || existing.id !== options.excludeMessageId)
      ) {
        const el = getMessageElementById(existing.id);
        if (el) {
          const { offsetFromTop, offsetFromBottom, edgeDistance } =
            readAnchorOffset(el, direction, containerEl);
          const now = Date.now();
          const ageMs = now - existing.capturedAt;
          const maxDistancePx =
            containerEl.clientHeight *
            PREFER_EXISTING_ANCHOR_MAX_DISTANCE_MULTIPLIER;

          if (
            ageMs > PREFER_EXISTING_ANCHOR_MAX_AGE_MS ||
            edgeDistance > maxDistancePx
          ) {
          } else {
            const region = isInPlaceholderRegion(pos);
            const offsetType: AnchorData["offsetType"] =
              direction === "bottom" ? "fromBottom" : "fromTop";
            const rawOffset =
              offsetType === "fromBottom" ? offsetFromBottom : offsetFromTop;
            const min = -el.offsetHeight;
            const max = containerEl.clientHeight;
            const offsetToStore =
              region === 0
                ? rawOffset
                : Math.max(min, Math.min(max, rawOffset));

            if (offsetToStore !== rawOffset) {
            }
            setAnchor(
              kind,
              {
                id: existing.id,
                offsetFromAnchor: offsetToStore,
                offsetType,
                direction,
                capturedAt: now,
                capturedScrollTop: pos.scrollTop,
                capturedScrollHeight: pos.scrollHeight,
              },
              pos,
            );
            return;
          }
        }
      }

      const messages = getMessageElements();
      if (messages.length === 0) return;

      let bestId: string | null = null;
      let bestEl: HTMLElement | null = null;
      let bestOffsetFromTop = 0;
      let bestOffsetFromBottom = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      let excludedCount = 0;

      for (const messageEl of messages) {
        const messageId = messageEl.getAttribute("data-message-id");
        if (!messageId) continue;
        if (
          options?.excludeMessageId &&
          messageId === options.excludeMessageId
        ) {
          excludedCount += 1;
          continue;
        }
        const { offsetFromTop, offsetFromBottom, edgeDistance } =
          readAnchorOffset(messageEl, direction, containerEl);
        if (edgeDistance < bestDistance) {
          bestDistance = edgeDistance;
          bestId = messageId;
          bestEl = messageEl;
          bestOffsetFromTop = offsetFromTop;
          bestOffsetFromBottom = offsetFromBottom;
        }
      }

      if (!bestId) return;
      if (!bestEl) return;

      const maxCaptureDistancePx =
        containerEl.clientHeight *
        PREFER_EXISTING_ANCHOR_MAX_DISTANCE_MULTIPLIER;
      if (bestDistance > maxCaptureDistancePx && existing?.id) {
        return;
      }

      const region = isInPlaceholderRegion(pos);
      const offsetType: AnchorData["offsetType"] =
        direction === "bottom" ? "fromBottom" : "fromTop";
      const rawOffset =
        offsetType === "fromBottom" ? bestOffsetFromBottom : bestOffsetFromTop;
      const min = -bestEl.offsetHeight;
      const max = containerEl.clientHeight;
      const bestOffsetToStore =
        region === 0 ? rawOffset : Math.max(min, Math.min(max, rawOffset));

      if (bestOffsetToStore !== rawOffset) {
      }

      setAnchor(
        kind,
        {
          id: bestId,
          offsetFromAnchor: bestOffsetToStore,
          offsetType,
          direction,
          capturedAt: Date.now(),
          capturedScrollTop: pos.scrollTop,
          capturedScrollHeight: pos.scrollHeight,
        },
        pos,
      );
    },
    [
      getMessageElementById,
      getMessageElements,
      getScrollPosition,
      isInPlaceholderRegion,
      readAnchorOffset,
      setAnchor,
    ],
  );

  const fixWithAnchor = useCallback(
    (anchor: AnchorData, reason: string): boolean => {
      const containerEl = containerRef.current;
      if (!containerEl) return false;
      const anchorEl = getMessageElementById(anchor.id);
      if (!anchorEl) return false;

      const rect = anchorEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const currentOffset =
        anchor.offsetType === "fromBottom"
          ? containerRect.bottom - rect.bottom
          : rect.top - containerRect.top;
      const delta = currentOffset - anchor.offsetFromAnchor;

      if (Math.abs(delta) < ANCHOR_APPLY_EPSILON_PX) return true;

      const beforeScrollTop = containerEl.scrollTop;
      const nextScrollTop =
        anchor.offsetType === "fromBottom"
          ? beforeScrollTop - delta
          : beforeScrollTop + delta;

      logScrollWrite(reason, beforeScrollTop, nextScrollTop, {
        source: "fixWithAnchor",
        anchorId: anchor.id,
        offsetType: anchor.offsetType,
        currentOffset: Number(currentOffset.toFixed(1)),
        desiredOffset: Number(anchor.offsetFromAnchor.toFixed(1)),
        anchorDelta: Number(delta.toFixed(1)),
        rectTop: Number((rect.top - containerRect.top).toFixed(1)),
        rectBottom: Number((containerRect.bottom - rect.bottom).toFixed(1)),
      });

      markProgrammaticWrite(reason);
      if (anchor.offsetType === "fromBottom") {
        containerEl.scrollTop -= delta;
      } else {
        containerEl.scrollTop += delta;
      }
      // Sync caches immediately; this write can happen without a subsequent scroll
      // event (or inside another handler where we already captured `pos`).
      scrollTopCacheRef.current = containerEl.scrollTop;
      offsetHeightCacheRef.current = containerEl.clientHeight;
      scrollHeightCacheRef.current = containerEl.scrollHeight;
      prevScrollTopForSpeedRef.current = containerEl.scrollTop;
      return true;
    },
    [getMessageElementById, logScrollWrite, markProgrammaticWrite],
  );

  const chooseFixAnchor = useCallback((): AnchorData | null => {
    const now = Date.now();
    const fetchAnchor = messageFetchAnchorRef.current;
    if (fetchAnchor && now <= fetchAnchorLiveUntilRef.current)
      return fetchAnchor;
    return automaticAnchorRef.current ?? fetchAnchor ?? null;
  }, []);

  const getOffsetToTriggerLoading = useCallback(
    (direction: "top" | "bottom", posOverride?: ScrollPosition): number => {
      const pos = posOverride ?? getScrollPosition();
      if (!pos) return 0;

      const { hasMoreBefore, hasMoreAfter, placeholderHeightPx } =
        placeholderStateRef.current;

      if (direction === "top") {
        if (!hasMoreBefore) return 0;
        // Trigger when viewport top reaches the bottom of the top skeleton,
        // with a small band to prefetch earlier.
        return placeholderHeightPx + TRIGGER_EDGE_BAND_PX;
      }

      const { scrollHeight, clientHeight } = pos;
      // Trigger when viewport bottom reaches the top of the bottom skeleton,
      // with a small band to prefetch earlier.
      return hasMoreAfter
        ? scrollHeight -
            clientHeight -
            placeholderHeightPx -
            TRIGGER_EDGE_BAND_PX
        : scrollHeight - clientHeight;
    },
    [getScrollPosition],
  );

  const getOffsetToPreventLoading = useCallback(
    (direction: "top" | "bottom", posOverride?: ScrollPosition): number => {
      const pos = posOverride ?? getScrollPosition();
      if (!pos) return 0;

      const { hasMoreBefore, hasMoreAfter } = placeholderStateRef.current;
      let n = 0;
      if (direction === "top" && hasMoreBefore) n = 2;
      if (direction === "bottom" && hasMoreAfter) n = -2;
      return getOffsetToTriggerLoading(direction, pos) + n;
    },
    [getOffsetToTriggerLoading, getScrollPosition],
  );

  const isInScrollTriggerLoadingRegion = useCallback(
    (posOverride?: ScrollPosition): 0 | 1 | 2 => {
      const pos = posOverride ?? getScrollPosition();
      if (!pos) return 0;

      const { hasMoreBefore, hasMoreAfter } = placeholderStateRef.current;
      const topOffset = getOffsetToTriggerLoading("top", pos);
      const bottomOffset = getOffsetToTriggerLoading("bottom", pos);

      if (
        hasMoreBefore &&
        pos.scrollTop <= topOffset &&
        pos.scrollHeight > pos.clientHeight
      ) {
        return 1;
      }
      if (hasMoreAfter && pos.scrollTop >= bottomOffset) {
        return 2;
      }
      return 0;
    },
    [getOffsetToTriggerLoading, getScrollPosition],
  );

  const updateStoreDimensions = useCallback(
    (callback?: () => void) => {
      const key = dimensionsKeyRef.current;
      if (!key) {
        callback?.();
        return;
      }

      const pos = getScrollPosition();
      if (!pos) {
        callback?.();
        return;
      }

      if (pinnedRef.current) {
        chatScrollDimensionsStore.updateChannelDimensions(key, 1, 1, 0, {
          isPinned: true,
        });
        callback?.();
        return;
      }

      const placeholderHeightPx =
        placeholderStateRef.current.placeholderHeightPx;
      chatScrollDimensionsStore.updateChannelDimensions(
        key,
        pos.scrollTop - placeholderHeightPx,
        pos.scrollHeight - placeholderHeightPx,
        pos.clientHeight,
        { isPinned: false },
      );
      callback?.();
    },
    [getScrollPosition],
  );

  const updateStoreDimensionsDebounced = useCallback(
    (callback?: () => void) => {
      if (callback) pendingDimensionCallbacksRef.current.push(callback);

      if (pinnedRef.current) {
        updateStoreDimensions();
        return;
      }

      if (updateDimensionsDebounceRef.current != null) {
        window.clearTimeout(updateDimensionsDebounceRef.current);
      }

      updateDimensionsDebounceRef.current = window.setTimeout(() => {
        updateDimensionsDebounceRef.current = null;
        const callbacks = pendingDimensionCallbacksRef.current;
        pendingDimensionCallbacksRef.current = [];
        updateStoreDimensions(() => {
          callbacks.forEach((cb) => cb());
        });
      }, 200);
    },
    [updateStoreDimensions],
  );

  const mergeTo = useCallback(
    (to: number, reason: string) => {
      const containerEl = containerRef.current;
      if (containerEl) {
        logScrollWrite(reason, containerEl.scrollTop, to, {
          source: "mergeTo",
        });
      }
      markProgrammaticWrite(reason);
      springRef.current?.mergeTo({ to });
      if (pinnedRef.current) {
        updateStoreDimensions();
      } else {
        updateStoreDimensionsDebounced();
      }
    },
    [
      logScrollWrite,
      markProgrammaticWrite,
      updateStoreDimensions,
      updateStoreDimensionsDebounced,
    ],
  );

  const handleScrollSpeed = useCallback(() => {
    if (interactionStateRef.current.isScrollLoadingDisabled) return;
    if (interactionStateRef.current.isDragging) return;

    const containerEl = containerRef.current;
    if (!containerEl) return;
    const pos = getScrollPosition();
    if (!pos) return;

    const prev = prevScrollTopForSpeedRef.current;
    prevScrollTopForSpeedRef.current = pos.scrollTop;
    if (prev == null) return;

    const region = isInPlaceholderRegion(pos);
    if (region === 0) return;

    // If we're already clamped to a hard edge while in placeholder, a wheel/touch
    // gesture might not change `scrollTop`, so the delta-based logic below won't
    // run. Snap back to the placeholder boundary.
    const placeholderHeightPx = placeholderStateRef.current.placeholderHeightPx;
    const maxScrollTop = Math.max(0, pos.scrollHeight - pos.clientHeight);
    const hardEdgeEps = 1;

    if (region === 1 && pos.scrollTop <= hardEdgeEps) {
      const target = Math.max(
        0,
        Math.min(maxScrollTop, placeholderHeightPx - pos.clientHeight),
      );
      if (Math.abs(containerEl.scrollTop - target) > hardEdgeEps) {
        mergeTo(target, "placeholder:top:hard-edge");
        prevScrollTopForSpeedRef.current = target;
        return;
      }
    }

    if (region === 2 && pos.distanceFromBottom <= hardEdgeEps) {
      const target = Math.max(
        0,
        Math.min(maxScrollTop, pos.scrollHeight - placeholderHeightPx),
      );
      if (Math.abs(containerEl.scrollTop - target) > hardEdgeEps) {
        mergeTo(target, "placeholder:bottom:hard-edge");
        prevScrollTopForSpeedRef.current = target;
        return;
      }
    }

    const deltaScrollTop = pos.scrollTop - prev;
    if (deltaScrollTop === 0) return;

    if (region === 1 && pos.scrollTop + deltaScrollTop <= 0) {
      const target = placeholderHeightPx - pos.clientHeight;
      mergeTo(target, "placeholder:top");
      prevScrollTopForSpeedRef.current = target;
      return;
    }

    if (
      region === 2 &&
      pos.scrollTop + deltaScrollTop >= pos.scrollHeight - pos.clientHeight
    ) {
      const target = pos.scrollHeight - placeholderHeightPx;
      mergeTo(target, "placeholder:bottom");
      prevScrollTopForSpeedRef.current = target;
    }
  }, [getScrollPosition, isInPlaceholderRegion, mergeTo]);

  const fixAnchorScrollPosition = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const transaction = transactionRef.current;
    if (pendingRestoreRef.current != null && transaction.phase !== "idle") {
      return;
    }

    const anchorData = getAnchorFixData();
    if (!anchorData) {
      return;
    }

    const { node, fixedScrollTop } = anchorData;
    const beforeTop = containerEl.scrollTop;
    const delta = fixedScrollTop - beforeTop;

    mergeTo(fixedScrollTop, "fix:anchor");

    if (isActivelyScrolling()) {
      setAutomaticAnchor(null);
    } else {
      setAutomaticAnchor(findAnchor());
    }

    const loading =
      loadingRef.current ||
      paginationStateRef.current.isFetchingTop ||
      paginationStateRef.current.isFetchingBottom;
    const hasPendingRestore = pendingRestoreRef.current != null;
    const inTransaction = transactionRef.current.phase !== "idle";
    const now = Date.now();
    const fetchHot =
      messageFetchAnchorRef.current != null &&
      now <= fetchAnchorLiveUntilRef.current;
    if (!loading && !hasPendingRestore && !inTransaction && !fetchHot) {
      if (messageFetchAnchorRef.current != null) {
      }
      messageFetchAnchorRef.current = null;
    }
  }, [
    findAnchor,
    getAnchorFixData,
    isActivelyScrolling,
    mergeTo,
    setAutomaticAnchor,
  ]);

  const fixScrollPosition = useCallback(
    (_reason: string) => {
      const containerEl = containerRef.current;
      if (!containerEl) return;

      const pos = getScrollPosition();
      if (!pos) return;

      offsetHeightCacheRef.current = pos.clientHeight;
      scrollHeightCacheRef.current = pos.scrollHeight;

      if (pinnedRef.current && messageFetchAnchorRef.current == null) {
        const maxScrollTop = Math.max(
          0,
          containerEl.scrollHeight - containerEl.clientHeight,
        );
        if (Math.abs(containerEl.scrollTop - maxScrollTop) >= 1) {
          markProgrammaticWrite("fix:pinned-to-bottom");
          springRef.current?.to({
            to: maxScrollTop,
            from: containerEl.scrollTop,
            animate: false,
          });
        }
        return;
      }

      fixAnchorScrollPosition();
    },
    [fixAnchorScrollPosition, getScrollPosition, markProgrammaticWrite],
  );

  const restore = useCallback(
    (direction: "top" | "bottom", options?: RestoreOptions) => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const pos = getScrollPosition();
      if (!pos) return;

      const kind: "fetch" | "auto" = options?.kind ?? "fetch";
      pendingRestoreRef.current = {
        kind,
        direction,
        armedScrollHeight: pos.scrollHeight,
        armedScrollTop: pos.scrollTop,
        waitForScrollHeightDeltaPx: options?.waitForScrollHeightDeltaPx,
        cancelIfUserMovedPx: options?.cancelIfUserMovedPx,
        armedAt: Date.now(),
      };
      pendingRestoreSettleReadyRef.current = false;
      pendingRestoreSettlingRevisionRef.current =
        propsRef.current?.messages.compactRevision ?? null;
      if (pendingRestoreSettleRafRef.current != null) {
        window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
        pendingRestoreSettleRafRef.current = null;
      }

      if (kind === "fetch") {
        fetchAnchorLiveUntilRef.current =
          Date.now() + FIX_ON_GEOMETRY_MAX_AGE_MS;
        const tx = transactionRef.current;
        if (tx.phase === "loading" && tx.direction === direction) {
          transitionScrollTransaction("restoring");
        }
      }

      if (kind === "fetch") {
        const fetchAnchor = messageFetchAnchorRef.current;
        if (fetchAnchor) {
          const anchorEl = containerEl.querySelector(
            `[data-message-id="${fetchAnchor.id}"]`,
          ) as HTMLElement | null;
          const domCompact = anchorEl?.dataset.messageCompact ?? "na";
          const domRevision = anchorEl?.dataset.compactRevision ?? "na";
          const stateCompactRevision =
            propsRef.current?.messages.compactRevision ?? null;
        }
      }
    },
    [getScrollPosition, transitionScrollTransaction],
  );

  const cancelRestore = useCallback(() => {
    pendingRestoreRef.current = null;
    pendingRestoreSettleReadyRef.current = false;
    pendingRestoreSettlingRevisionRef.current = null;
    if (pendingRestoreSettleRafRef.current != null) {
      window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
      pendingRestoreSettleRafRef.current = null;
    }
    completeScrollTransaction("restore-cancelled");
  }, [completeScrollTransaction]);

  const suppressTriggers = useCallback((durationMs: number = 100) => {
    suppressUntilRef.current = Date.now() + durationMs;
  }, []);

  const isTriggersSupressed = useCallback(() => {
    return Date.now() < suppressUntilRef.current;
  }, []);

  const scrollToBottom = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const maxScrollTop = Math.max(
      0,
      containerEl.scrollHeight - containerEl.clientHeight,
    );
    if (Math.abs(containerEl.scrollTop - maxScrollTop) < 1) return;
    logScrollWrite("scrollToBottom", containerEl.scrollTop, maxScrollTop, {
      source: "scrollToBottom",
    });
    markProgrammaticWrite("scrollToBottom");
    springRef.current?.to({
      to: maxScrollTop,
      from: containerEl.scrollTop,
      animate: false,
    });
    if (pinnedRef.current) {
      updateStoreDimensions();
    } else {
      updateStoreDimensionsDebounced();
    }
  }, [
    logScrollWrite,
    markProgrammaticWrite,
    updateStoreDimensions,
    updateStoreDimensionsDebounced,
  ]);

  const scrollTo = useCallback(
    (to: number, reason: string) => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const maxScrollTop = Math.max(
        0,
        containerEl.scrollHeight - containerEl.clientHeight,
      );
      const clamped = Math.max(0, Math.min(maxScrollTop, to));
      if (!Number.isFinite(clamped)) return;
      if (Math.abs(containerEl.scrollTop - clamped) < 1) return;

      logScrollWrite(reason, containerEl.scrollTop, clamped, {
        source: "scrollTo",
      });

      markProgrammaticWrite(reason);
      springRef.current?.to({
        to: clamped,
        from: containerEl.scrollTop,
        animate: false,
      });
      if (pinnedRef.current) {
        updateStoreDimensions();
      } else {
        updateStoreDimensionsDebounced();
      }
    },
    [
      logScrollWrite,
      markProgrammaticWrite,
      updateStoreDimensions,
      updateStoreDimensionsDebounced,
    ],
  );

  const loadMore = useCallback(
    async (direction: "top" | "bottom") => {
      if (interactionStateRef.current.isScrollLoadingDisabled) return;
      if (interactionStateRef.current.isDragging) return;

      const state = paginationStateRef.current;
      if (!state.canLoadMore) return;
      if (loadingRef.current) return;

      const now = Date.now();
      if (
        state.debounceMs > 0 &&
        now - lastLoadAtRef.current < state.debounceMs
      ) {
        return;
      }

      const wantsTop = direction === "top";
      if (wantsTop && (!state.canPaginateTop || state.isFetchingTop)) return;
      if (!wantsTop && (!state.canPaginateBottom || state.isFetchingBottom))
        return;

      const fn = wantsTop ? state.loadMoreTop : state.loadMoreBottom;
      if (!fn) return;

      const pos = getScrollPosition();
      if (!pos) return;

      if (!beginScrollTransaction(direction)) return;

      lastLoadAtRef.current = now;
      loadingRef.current = true;
      scrollHeightBeforeLoadRef.current =
        scrollHeightCacheRef.current ?? pos.scrollHeight;

      const fetchAnchor = findFetchAnchor(direction === "bottom");
      if (fetchAnchor) {
        messageFetchAnchorRef.current = fetchAnchor;
        fetchAnchorLiveUntilRef.current =
          Date.now() + FIX_ON_GEOMETRY_MAX_AGE_MS;
        restore(direction, {
          kind: "fetch",
          waitForScrollHeightDeltaPx: state.restoreWaitForScrollHeightDeltaPx,
          cancelIfUserMovedPx: state.restoreCancelIfUserMovedPx,
        });
      } else {
        messageFetchAnchorRef.current = null;
      }

      try {
        const result = await fn();
        if (!result.ok) {
          completeScrollTransaction("load-result-not-ok");
          return;
        }

        if (pendingRestoreRef.current != null) {
          transitionScrollTransaction("restoring");
        } else {
          completeScrollTransaction("load-ok-no-pending-restore");
        }
      } catch (e) {
        loadingRef.current = false;
        completeScrollTransaction("load-error");
        logger.error(`[SCROLL-MANAGER] loadMore(${direction}) failed:`, e);
      }
    },
    [
      beginScrollTransaction,
      completeScrollTransaction,
      findFetchAnchor,
      getScrollPosition,
      restore,
      transitionScrollTransaction,
    ],
  );

  const handleScroll = useCallback(
    (event?: Event) => {
      const pos = getScrollPosition();
      if (!pos) return;

      const containerEl = containerRef.current;
      if (
        event != null &&
        containerEl != null &&
        event.target !== containerEl
      ) {
        return;
      }

      const prevClientHeight = offsetHeightCacheRef.current;
      const prevScrollHeight = scrollHeightCacheRef.current;
      const prevScrollTop = scrollTopCacheRef.current;

      const heightChanged =
        prevClientHeight != null && prevScrollHeight != null
          ? prevClientHeight !== pos.clientHeight ||
            prevScrollHeight !== pos.scrollHeight
          : false;
      const scrollTopChanged =
        prevScrollTop != null && prevScrollTop !== pos.scrollTop;

      const clearAnchorTimer = () => {
        if (automaticAnchorTimeoutRef.current == null) return;
        window.clearTimeout(automaticAnchorTimeoutRef.current);
        automaticAnchorTimeoutRef.current = null;
      };

      if (heightChanged) {
        scrollCounterRef.current = 0;
        clearAnchorTimer();
        if (!pinnedRef.current) {
          if (automaticAnchorRef.current == null) {
            setAutomaticAnchor(findAnchor());
          } else {
            updateAutomaticAnchor(pos.scrollTop, true);
          }
        }
        fixScrollPosition("fix:scroll:height-change");
        scrollTopCacheRef.current = pos.scrollTop;
      } else if (scrollTopChanged) {
        const deltaScrollTopObserved =
          prevScrollTop == null ? 0 : pos.scrollTop - prevScrollTop;
        const recentProg =
          Date.now() - lastProgrammaticWriteAtRef.current <=
          PROGRAMMATIC_WRITE_WINDOW_MS;
        const tx = transactionRef.current;
        if (recentProg || tx.phase === "restoring") {
        }

        if (loadMorePausedUntilUserScrollRef.current && event != null) {
          loadMorePausedUntilUserScrollRef.current = false;
        }

        pinnedRef.current = isScrolledToBottom(pos);
        scrollCounterRef.current = Math.min(scrollCounterRef.current + 1, 5);

        if (pinnedRef.current) {
          clearAutomaticAnchor();
        } else if (automaticAnchorRef.current) {
          updateAutomaticAnchor(pos.scrollTop, true);
        } else {
          setAutomaticAnchor(findAnchor());
        }

        scrollTopCacheRef.current = pos.scrollTop;

        clearAnchorTimer();
        automaticAnchorTimeoutRef.current = window.setTimeout(() => {
          scrollCounterRef.current = 0;
          automaticAnchorTimeoutRef.current = null;
          prevScrollTopForSpeedRef.current = null;

          const latest = getScrollPosition();
          if (!latest) return;
          const changedAfterTimeout =
            latest.clientHeight !== offsetHeightCacheRef.current ||
            latest.scrollHeight !== scrollHeightCacheRef.current;
          if (changedAfterTimeout) {
            handleScrollRef.current?.();
            return;
          }

          clearAutomaticAnchor();
          if (!pinnedRef.current) {
            setAutomaticAnchor(findAnchor());
          }
        }, AUTO_ANCHOR_IDLE_TIMEOUT_MS);
      }

      offsetHeightCacheRef.current = pos.clientHeight;
      scrollHeightCacheRef.current = pos.scrollHeight;
      scrollTopCacheRef.current = pos.scrollTop;

      handleScrollSpeed();

      if (isScrollLoadingDisabled()) return;
      if (isTriggersSupressed()) return;
      if (interactionStateRef.current.isDragging) {
        return;
      }

      const transaction = transactionRef.current;
      if (transaction.phase !== "idle") {
        return;
      }

      const region = isInScrollTriggerLoadingRegion(pos);
      if (region !== 0) {
        const topOffset = getOffsetToTriggerLoading("top", pos);
        const bottomOffset = getOffsetToTriggerLoading("bottom", pos);
        const { hasMoreBefore, hasMoreAfter, placeholderHeightPx } =
          placeholderStateRef.current;
      }

      if (region === 1) void loadMore("top");
      else if (region === 2) void loadMore("bottom");
    },
    [
      clearAutomaticAnchor,
      findAnchor,
      fixScrollPosition,
      getTopVisibleSnapshot,
      getScrollPosition,
      getOffsetToTriggerLoading,
      handleScrollSpeed,
      isScrollLoadingDisabled,
      isInScrollTriggerLoadingRegion,
      isScrolledToBottom,
      isTriggersSupressed,
      loadMore,
      setAutomaticAnchor,
      updateAutomaticAnchor,
    ],
  );

  handleScrollRef.current = handleScroll;

  const isLoading = useCallback(() => {
    return (
      loadingRef.current || (propsRef.current?.messages.loadingMore ?? false)
    );
  }, []);

  const isInitialized = useCallback(() => {
    return initialScrollTopRef.current === undefined;
  }, []);

  const restoreScroll = useCallback(() => {
    if (isInitialized()) return;
    const initial = initialScrollTopRef.current;
    initialScrollTopRef.current = undefined;
    if (initial == null) {
      scrollToBottom();
      return;
    }
    scrollTo(
      initial + (propsRef.current?.placeholderHeight ?? 0),
      "restore:initial-scroll",
    );
  }, [isInitialized, scrollTo, scrollToBottom]);

  const getSnapshotBeforeUpdate = useCallback(() => {
    if (!hasAnchor()) return;

    const pos = getScrollPosition();
    if (!pos) return;

    updateFetchAnchor(pos.scrollTop, pos.clientHeight, pos.scrollHeight);
    updateAutomaticAnchor(pos.scrollTop);
  }, [getScrollPosition, hasAnchor, updateAutomaticAnchor, updateFetchAnchor]);

  const mergePropsAndUpdate_ = useCallback(
    (next: ScrollManagerMergeProps) => {
      const prevMessages = propsRef.current?.messages;

      propsRef.current = next;

      setPlaceholderState({
        hasMoreBefore: next.messages.hasMoreBefore,
        hasMoreAfter: next.messages.hasMoreAfter,
        placeholderHeightPx: next.placeholderHeight,
      });

      setPaginationState({
        canLoadMore: next.canLoadMore,
        canPaginateTop: next.canPaginateTop ?? false,
        canPaginateBottom: next.canPaginateBottom ?? false,
        isFetchingTop: next.isFetchingTop ?? false,
        isFetchingBottom: next.isFetchingBottom ?? false,
        loadMoreTop: next.loadMoreTop,
        loadMoreBottom: next.loadMoreBottom,
      });

      const pos = getScrollPosition();
      if (!pos) return;

      const state = paginationStateRef.current;
      const loadingMore = state.isFetchingTop || state.isFetchingBottom;
      const heightChanged = isHeightChange(pos.clientHeight, pos.scrollHeight);

      offsetHeightCacheRef.current = pos.clientHeight;
      scrollHeightCacheRef.current = pos.scrollHeight;
      loadingRef.current = next.messages.loadingMore || loadingMore;

      const prev = mergePrevRef.current;
      const currentDimensionsKey = next.messages.channelId;

      if (prev.dimensionsKey !== currentDimensionsKey) {
        loadMorePausedUntilUserScrollRef.current = false;
      } else if (prev.loadingMore && !loadingMore) {
        const delta = Math.abs(
          pos.scrollHeight - scrollHeightBeforeLoadRef.current,
        );
        loadMorePausedUntilUserScrollRef.current =
          delta < LOAD_PAUSE_MIN_SCROLL_HEIGHT_DELTA_PX;
      }

      mergePrevRef.current = {
        loadingMore,
        dimensionsKey: currentDimensionsKey,
      };

      if (!next.messages.ready) {
        return;
      }

      if (!isInitialized()) {
        restoreScroll();
        return;
      }

      if (heightChanged) {
        fixScrollPosition("fix:merge-props-height-change");
      }

      void prevMessages;
    },
    [
      fixScrollPosition,
      getScrollPosition,
      isHeightChange,
      isInitialized,
      restoreScroll,
      setPaginationState,
      setPlaceholderState,
    ],
  );

  const mergePropsAndUpdate = useCallback(
    (next: ScrollManagerMergeProps) => {
      mergePropsAndUpdate_(next);
    },
    [mergePropsAndUpdate_],
  );

  // Calling getSnapshotBeforeUpdate during render, before merge/update.
  // Calling it in useLayoutEffect captures post-commit geometry and can produce
  // oversized anchor corrections on truncation/compaction commits.
  getSnapshotBeforeUpdate();

  useLayoutEffect(() => {
    const next = options?.mergeProps;
    if (!next) return;
    mergePropsAndUpdate(next);
  }, [mergePropsAndUpdate, options?.mergeProps]);

  const applyPendingRestore = useCallback(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;

    const tx = transactionRef.current;
    if (
      pending.kind === "fetch" &&
      tx.phase === "loading" &&
      tx.direction === pending.direction
    ) {
      transitionScrollTransaction("restoring");
    }

    const containerEl = containerRef.current;
    if (!containerEl) {
      return;
    }

    const now = Date.now();
    const stateCompactRevision =
      propsRef.current?.messages.compactRevision ?? null;
    if (pendingRestoreSettlingRevisionRef.current !== stateCompactRevision) {
      pendingRestoreSettlingRevisionRef.current = stateCompactRevision;
      pendingRestoreSettleReadyRef.current = false;
      if (pendingRestoreSettleRafRef.current != null) {
        window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
      }
      pendingRestoreSettleRafRef.current = window.requestAnimationFrame(() => {
        pendingRestoreSettleRafRef.current = null;
        pendingRestoreSettleReadyRef.current = true;
        applyPendingRestoreRef.current?.();
      });
      return;
    }

    if (!pendingRestoreSettleReadyRef.current) {
      return;
    }

    const kindAnchor =
      pending.kind === "fetch"
        ? messageFetchAnchorRef.current
        : automaticAnchorRef.current;
    if (!kindAnchor) {
      return;
    }

    const pos = getScrollPosition();
    if (!pos) {
      return;
    }

    // If the user moved a lot after arming, rebase the anchor offset to the
    // current viewport so we still preserve what the user is looking at.
    if (
      pending.cancelIfUserMovedPx != null &&
      Math.abs(containerEl.scrollTop - pending.armedScrollTop) >
        pending.cancelIfUserMovedPx
    ) {
      const maxScrollTopNow = Math.max(
        0,
        containerEl.scrollHeight - containerEl.clientHeight,
      );
      const isClampedToBottomNow =
        Math.abs(containerEl.scrollTop - maxScrollTopNow) < 1;
      const shrankSinceArm =
        containerEl.scrollHeight + 1 < pending.armedScrollHeight;
      const armedBeyondNewMax = pending.armedScrollTop > maxScrollTopNow + 1;

      const clampedByShrinkToBottom =
        pending.direction === "bottom" &&
        shrankSinceArm &&
        armedBeyondNewMax &&
        isClampedToBottomNow;

      const deltaScrollTop = containerEl.scrollTop - pending.armedScrollTop;
      const recentUser =
        now - lastUserInputAtRef.current <= USER_INPUT_WINDOW_MS;

      // If scrollHeight shrank and the browser clamped scrollTop to the new max,
      // don't treat that as "user moved" (it produces huge negative offsets).
      if (clampedByShrinkToBottom) {
        pendingRestoreRef.current = {
          ...pending,
          armedScrollTop: containerEl.scrollTop,
          armedScrollHeight: containerEl.scrollHeight,
        };
      } else if (recentUser) {
        const rebasedOffset =
          kindAnchor.offsetType === "fromBottom"
            ? kindAnchor.offsetFromAnchor + deltaScrollTop
            : kindAnchor.offsetFromAnchor - deltaScrollTop;

        const rebased: AnchorData = {
          ...kindAnchor,
          offsetFromAnchor: rebasedOffset,
          capturedScrollTop: containerEl.scrollTop,
          capturedAt: Date.now(),
        };
        if (pending.kind === "fetch") {
          messageFetchAnchorRef.current = rebased;
        } else {
          automaticAnchorRef.current = rebased;
        }

        pendingRestoreRef.current = {
          ...pending,
          armedScrollTop: containerEl.scrollTop,
        };
      } else {
        pendingRestoreRef.current = {
          ...pending,
          armedScrollTop: containerEl.scrollTop,
        };
      }
    }

    const scrollHeightDelta = Math.abs(
      containerEl.scrollHeight - pending.armedScrollHeight,
    );
    const minDelta = pending.waitForScrollHeightDeltaPx ?? 0;

    const currentAnchor =
      pending.kind === "fetch"
        ? messageFetchAnchorRef.current
        : automaticAnchorRef.current;
    if (!currentAnchor) {
      return;
    }

    const anchorEl = getMessageElementById(currentAnchor.id);
    if (!anchorEl) {
      return;
    }

    // Gate restore on compactRevision: ensure the DOM has committed the same compaction
    // revision we're using in state. This makes compaction-related height diffs part of
    // the anchor delta instead of becoming post-restore drift.
    if (pending.kind === "fetch") {
      const domRev = anchorEl.dataset.compactRevision ?? "na";
      const waitedMs = now - pending.armedAt;
      if (
        stateCompactRevision != null &&
        domRev !== "na" &&
        domRev !== String(stateCompactRevision)
      ) {
        if (waitedMs <= COMPACT_REV_GATING_MAX_WAIT_MS) {
          if (pendingRestoreSettleRafRef.current != null) {
            window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
          }
          pendingRestoreSettleRafRef.current = window.requestAnimationFrame(
            () => {
              pendingRestoreSettleRafRef.current = null;
              applyPendingRestoreRef.current?.();
            },
          );
          return;
        }
      }
    }
    const rect = anchorEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const anchorDomCompactAtApply = anchorEl.dataset.messageCompact ?? "na";
    const anchorDomRevisionAtApply = anchorEl.dataset.compactRevision ?? "na";
    const compactRevisionAtApply =
      propsRef.current?.messages.compactRevision ?? null;
    const currentOffset =
      currentAnchor.offsetType === "fromBottom"
        ? containerRect.bottom - rect.bottom
        : rect.top - containerRect.top;
    const delta = currentOffset - currentAnchor.offsetFromAnchor;
    const hasAnchorMovementEvidence =
      Math.abs(delta) >= ANCHOR_APPLY_EPSILON_PX;

    // Evidence gating:
    // - If caller requested a minimum scrollHeight delta, prefer to wait for it,
    //   but still allow applying as soon as we have anchor movement evidence.
    //   This handles cases where content is inserted above AND evicted below in
    //   the same transaction (net scrollHeight delta can be small/zero while the
    //   anchor drifts significantly).
    // - Otherwise, wait until the anchor actually needs a correction (delta >= epsilon)
    //   or the scrollHeight changed (layout shift).
    if (
      minDelta > 0 &&
      scrollHeightDelta < minDelta &&
      !hasAnchorMovementEvidence
    ) {
      return;
    }

    if (minDelta === 0 && !hasAnchorMovementEvidence && scrollHeightDelta < 1) {
      return;
    }

    const beforeApplyScrollTop = containerEl.scrollTop;
    const beforeApplyScrollHeight = containerEl.scrollHeight;

    const applied = fixWithAnchor(
      currentAnchor,
      `restore:${pending.kind}:${pending.direction}`,
    );
    if (!applied) {
      return;
    }

    // Snaps to the placeholder boundary so the user doesn't get "stuck"
    // seeing the full skeleton/placeholder until another scroll happens.
    const posAfter = getScrollPosition();
    if (posAfter) {
      const regionAfter = isInPlaceholderRegion(posAfter);
      if (regionAfter !== 0) {
        const placeholderHeightPx =
          placeholderStateRef.current.placeholderHeightPx;
        const maxScrollTop = Math.max(
          0,
          posAfter.scrollHeight - posAfter.clientHeight,
        );
        const hardEdgeEps = 1;

        if (regionAfter === 1 && posAfter.scrollTop <= hardEdgeEps) {
          const target = Math.max(
            0,
            Math.min(maxScrollTop, placeholderHeightPx - posAfter.clientHeight),
          );
          if (Math.abs(containerEl.scrollTop - target) > hardEdgeEps) {
            mergeTo(target, "placeholder:top:post-restore");
            prevScrollTopForSpeedRef.current = target;
          }
        } else if (
          regionAfter === 2 &&
          posAfter.distanceFromBottom <= hardEdgeEps
        ) {
          const target = Math.max(
            0,
            Math.min(maxScrollTop, posAfter.scrollHeight - placeholderHeightPx),
          );
          if (Math.abs(containerEl.scrollTop - target) > hardEdgeEps) {
            mergeTo(target, "placeholder:bottom:post-restore");
            prevScrollTopForSpeedRef.current = target;
          }
        }
      }
    }

    // Ensure caches reflect the post-restore scroll position. Without this, the
    // next user scroll delta can appear near-zero (because the cached value is
    // still pre-restore), masking real post-restore movement and confusing diagnostics.
    scrollTopCacheRef.current = containerEl.scrollTop;
    offsetHeightCacheRef.current = containerEl.clientHeight;
    scrollHeightCacheRef.current = containerEl.scrollHeight;
    prevScrollTopForSpeedRef.current = containerEl.scrollTop;

    // In the post-restore diagnostic window, avoid hover-driven media `src` churn
    // (e.g. swapping between static http URLs and animated blob URLs) while the
    // browser is most prone to doing scroll anchoring micro-adjustments.
    if (typeof window !== "undefined") {
      try {
        const now =
          typeof performance !== "undefined" &&
          typeof performance.now === "function"
            ? performance.now()
            : 0;
        (window as any).__gatherendMediaFreezeUntil =
          now + POST_RESTORE_MEDIA_FREEZE_MS;
      } catch {
        // ignore
      }
    }

    requestAnimationFrame(() => {
      const postEl = getMessageElementById(currentAnchor.id);
      if (!postEl) return;
      const postRect = postEl.getBoundingClientRect();
      const postContainerRect = containerEl.getBoundingClientRect();
      const postOffset =
        currentAnchor.offsetType === "fromBottom"
          ? postContainerRect.bottom - postRect.bottom
          : postRect.top - postContainerRect.top;
    });

    // Update geometry caches after a successful restore.
    lastSeenScrollHeightRef.current = containerEl.scrollHeight;
    lastSeenClientHeightRef.current = containerEl.clientHeight;

    pendingRestoreRef.current = null;
    pendingRestoreSettleReadyRef.current = false;
    pendingRestoreSettlingRevisionRef.current = null;
    if (pendingRestoreSettleRafRef.current != null) {
      window.cancelAnimationFrame(pendingRestoreSettleRafRef.current);
      pendingRestoreSettleRafRef.current = null;
    }
    completeScrollTransaction("restore-applied");
  }, [
    completeScrollTransaction,
    fixWithAnchor,
    getMessageElementById,
    getTopVisibleSnapshot,
    getScrollPosition,
    isInPlaceholderRegion,
    mergeTo,
    transitionScrollTransaction,
  ]);

  useLayoutEffect(() => {
    applyPendingRestore();
  });

  applyPendingRestoreRef.current = applyPendingRestore;

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const contentEl = contentRef.current ?? containerEl;
    const prevContainerInline =
      containerEl.style.getPropertyValue("overflow-anchor");
    const prevContainerPriority =
      containerEl.style.getPropertyPriority("overflow-anchor");
    containerEl.style.setProperty("overflow-anchor", "none", "important");

    const prevContentInline =
      contentEl.style.getPropertyValue("overflow-anchor");
    const prevContentPriority =
      contentEl.style.getPropertyPriority("overflow-anchor");
    contentEl.style.setProperty("overflow-anchor", "none", "important");

    const onWheel = (e: WheelEvent) => {
      markUserInput();
    };
    const onTouchMove = () => {
      markUserInput();
    };

    const scheduleDragReleaseRecheck = () => {
      if (dragReleaseRecheckRafRef.current != null) {
        window.cancelAnimationFrame(dragReleaseRecheckRafRef.current);
      }
      dragReleaseRecheckRafRef.current = window.requestAnimationFrame(() => {
        dragReleaseRecheckRafRef.current = null;
        // Re-evaluate triggers on the final scrollTop after the thumb drag ends.
        handleScrollRef.current?.();
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") setDragging(true);
      markUserInput();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        setDragging(false);
        scheduleDragReleaseRecheck();
      }
    };
    const onPointerCancel = () => {
      setDragging(false);
      scheduleDragReleaseRecheck();
    };
    const onWindowBlur = () => {
      setDragging(false);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons) markUserInput();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const keys = new Set([
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ]);
      if (keys.has(e.key)) markUserInput();
    };

    containerEl.addEventListener("wheel", onWheel, { passive: true });
    containerEl.addEventListener("touchmove", onTouchMove, { passive: true });
    containerEl.addEventListener("pointerdown", onPointerDown, {
      passive: true,
    });
    containerEl.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, {
      passive: true,
    });
    window.addEventListener("blur", onWindowBlur, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });

    const initial = getScrollPosition();
    if (initial) {
      lastSeenScrollHeightRef.current = initial.scrollHeight;
      lastSeenClientHeightRef.current = initial.clientHeight;
      offsetHeightCacheRef.current = initial.clientHeight;
      scrollHeightCacheRef.current = initial.scrollHeight;
      scrollTopCacheRef.current = initial.scrollTop;
    }

    return () => {
      containerEl.removeEventListener("wheel", onWheel);
      containerEl.removeEventListener("touchmove", onTouchMove);
      containerEl.removeEventListener("pointerdown", onPointerDown);
      containerEl.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("keydown", onKeyDown);
      if (dragReleaseRecheckRafRef.current != null) {
        window.cancelAnimationFrame(dragReleaseRecheckRafRef.current);
        dragReleaseRecheckRafRef.current = null;
      }

      containerEl.style.setProperty(
        "overflow-anchor",
        prevContainerInline,
        prevContainerPriority,
      );
      contentEl.style.setProperty(
        "overflow-anchor",
        prevContentInline,
        prevContentPriority,
      );
    };
  }, [
    getScrollPosition,
    markUserInput,
    setDragging,
    options?.dimensionsKey,
    options?.mergeProps?.messages.ready,
  ]);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    if (typeof ResizeObserver === "undefined") return;

    const contentEl = contentRef.current ?? containerEl;

    const observer = new ResizeObserver(() => {
      if (resizeFixInProgressRef.current) return;
      resizeFixInProgressRef.current = true;
      try {
        // If a restore is pending, let the layout effect apply it.
        if (pendingRestoreRef.current) return;

        const recentProg =
          Date.now() - lastProgrammaticWriteAtRef.current <=
          PROGRAMMATIC_WRITE_WINDOW_MS;
        if (recentProg) {
          const anchor = chooseFixAnchor();
          // If the fetch anchor is active, keep stabilizing even immediately
          // after a programmatic write (pagination is a transaction).
          if (!anchor || anchor === automaticAnchorRef.current) return;
        }

        const prevHeight = lastSeenScrollHeightRef.current;
        const prevClientHeight = lastSeenClientHeightRef.current;

        const pos = getScrollPosition();
        if (!pos) return;

        const heightChanged =
          prevHeight != null && Math.abs(pos.scrollHeight - prevHeight) >= 1;
        const clientChanged =
          prevClientHeight != null &&
          Math.abs(pos.clientHeight - prevClientHeight) >= 1;

        if (!heightChanged && !clientChanged) return;

        lastSeenScrollHeightRef.current = pos.scrollHeight;
        lastSeenClientHeightRef.current = pos.clientHeight;

        fixScrollPosition("fix:geometry");
      } finally {
        resizeFixInProgressRef.current = false;
      }
    });

    resizeObserverRef.current = observer;
    observer.observe(containerEl);
    if (contentEl !== containerEl) observer.observe(contentEl);

    return () => {
      observer.disconnect();
      if (resizeObserverRef.current === observer)
        resizeObserverRef.current = null;
    };
  }, [
    chooseFixAnchor,
    fixScrollPosition,
    getScrollPosition,
    options?.dimensionsKey,
    options?.mergeProps?.messages.ready,
  ]);

  return {
    getScrollPosition,
    capture,
    restore,
    cancelRestore,
    setScrollLoadingDisabled,
    setPlaceholderState,
    setPaginationState,
    setPinned,
    getOffsetToTriggerLoading,
    getOffsetToPreventLoading,
    isInScrollTriggerLoadingRegion,
    handleScrollSpeed,
    handleScroll,
    suppressTriggers,
    isTriggersSupressed,
    scrollTo,
    scrollToBottom,
    updateStoreDimensions,
    updateStoreDimensionsDebounced,
    fixScrollPosition,
    mergePropsAndUpdate,
    mergePropsAndUpdate_,
    getSnapshotBeforeUpdate,
    isLoading,
    isInitialized,
    isActivelyScrolling,
    restoreScroll,
    reportMessageLayoutCommit,
    hasPendingRestore: () => Boolean(pendingRestoreRef.current),
  };
}

export type ScrollManager = ReturnType<typeof useScrollManager>;
