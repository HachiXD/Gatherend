import { useCallback, useEffect, useMemo } from "react";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";
import {
  chatMessageWindowStore,
  useChatMessageWindowStoreSelector,
} from "@/src/features/chat/store/chat-message-window-store";
import { useSocket } from "@/src/providers/socket-context";

export type FetchPageFn = (
  cursor: string | undefined,
  direction: "before" | "after",
  limit: number,
) => Promise<{
  items: ChatMessage[];
  nextCursor: string | null;
  previousCursor: string | null;
}>;

export interface UseChatMessageWindowProps {
  windowKey: string;
  fetchPage: FetchPageFn;
  enabled?: boolean;
}

export interface ChatMessageWindowApi {
  windowKey: string;
  status: "idle" | "success" | "error";
  error: string | null;

  messages: ChatMessage[]; // oldest -> newest
  compactById: Record<string, boolean>;
  compactRevision: number;
  beforeCount: number;
  afterCount: number;

  hasMoreBefore: boolean;
  hasMoreAfter: boolean;

  isFetchingOlder: boolean;
  isFetchingNewer: boolean;

  ensureInitial: () => void;
  loadOlder: (
    batch?: number,
  ) => Promise<{ ok: boolean; kind: "cache" | "network" | "noop" }>;
  loadNewer: (
    batch?: number,
  ) => Promise<{ ok: boolean; kind: "cache" | "network" | "noop" }>;
  manageWindow: (
    direction: "up" | "down",
    options?: { target?: number; hardMax?: number },
  ) => { evicted: number; side: "top" | "bottom" | null };
  jumpToPresent: (keepCount: number) => void;
  goToPresent: (
    keepCount: number,
  ) => Promise<{ ok: boolean; kind: "cache" | "network" | "noop" }>;
}

// Keep at 40. Higher values cause visible geometry jumps when paging via cache.
const DEFAULT_BATCH = 40;

const PERSISTED_MESSAGE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const shallowEqual = <T extends Record<string, unknown>>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
};

export function useChatMessageWindow({
  windowKey,
  fetchPage,
  enabled = true,
}: UseChatMessageWindowProps): ChatMessageWindowApi {
  const { socket } = useSocket();

  const state = useChatMessageWindowStoreSelector(
    windowKey,
    (s) => ({
      error: s.error,
      hasFetchedInitial: s.hasFetchedInitial,
      needsCatchUp: s.needsCatchUp,
      isFetchingInitial: s.isFetchingInitial,
      isFetchingOlder: s.isFetchingOlder,
      isFetchingNewer: s.isFetchingNewer,
      messages: s.messages,
      compactById: s.compactById,
      compactRevision: s.compactRevision,
      beforeCount: s.before.length,
      afterCount: s.after.length,
      nextCursor: s.nextCursor,
      hasMoreAfter: s.hasMoreAfter,
    }),
    shallowEqual,
  );

  const status: ChatMessageWindowApi["status"] = useMemo(() => {
    if (state.error) return "error";
    if (state.hasFetchedInitial || state.messages.length > 0) return "success";
    return "idle";
  }, [state.error, state.hasFetchedInitial, state.messages.length]);

  const hasMoreBefore = state.beforeCount > 0 || Boolean(state.nextCursor);
  const hasMoreAfter = state.hasMoreAfter || state.afterCount > 0;

  const getNewestPersistedMessageId = useCallback((messages: ChatMessage[]) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const id = messages[i]?.id;
      if (typeof id === "string" && PERSISTED_MESSAGE_ID_REGEX.test(id)) {
        return id;
      }
    }
    return null;
  }, []);

  const ensureInitial = useCallback(() => {
    const live = chatMessageWindowStore.get(windowKey);
    if (live.hasFetchedInitial) return;
    if (live.isFetchingInitial) return;
    if (live.isFetchingOlder || live.isFetchingNewer) return;

    chatMessageWindowStore.setFetching(windowKey, { isFetchingInitial: true });

    void fetchPage(undefined, "before", DEFAULT_BATCH)
      .then((page) => {
        chatMessageWindowStore.seedInitial(
          windowKey,
          page.items ?? [],
          page.nextCursor ?? null,
        );
      })
      .catch((e) => {
        chatMessageWindowStore.setError(
          windowKey,
          e instanceof Error ? e.message : String(e),
        );
      });
  }, [fetchPage, windowKey]);

  useEffect(() => {
    if (!enabled) return;
    ensureInitial();
  }, [enabled, ensureInitial]);

  // Mark catch-up needed on socket reconnect so the window stays consistent
  // after a disconnect even if the component stays mounted.
  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => {
      chatMessageWindowStore.markNeedsCatchUpIfExists(windowKey);
    };
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, windowKey]);

  const catchUpIfNeeded = useCallback(() => {
    const live = chatMessageWindowStore.get(windowKey);
    if (!live.needsCatchUp) return;
    if (live.isFetchingInitial || live.isFetchingOlder || live.isFetchingNewer) {
      return;
    }

    if (!live.hasFetchedInitial || live.messages.length === 0) {
      ensureInitial();
      return;
    }

    const cursor = getNewestPersistedMessageId(live.messages);
    if (!cursor) {
      ensureInitial();
      return;
    }

    chatMessageWindowStore.setFetching(windowKey, { isFetchingNewer: true });

    void fetchPage(cursor, "after", DEFAULT_BATCH)
      .then((page) => {
        const serverHasMoreAfter = Boolean(page.previousCursor);
        chatMessageWindowStore.mergeNewerFromServer(windowKey, page.items ?? [], {
          hasMoreAfter: live.hasMoreAfter || serverHasMoreAfter,
          previousCursor: serverHasMoreAfter
            ? (page.previousCursor ?? null)
            : live.previousCursor,
        });
      })
      .catch((e) => {
        chatMessageWindowStore.setError(
          windowKey,
          e instanceof Error ? e.message : String(e),
        );
      });
  }, [ensureInitial, fetchPage, getNewestPersistedMessageId, windowKey]);

  useEffect(() => {
    if (!state.needsCatchUp) return;
    catchUpIfNeeded();
  }, [catchUpIfNeeded, state.needsCatchUp]);

  const loadOlder = useCallback(
    async (batch = DEFAULT_BATCH) => {
      const live = chatMessageWindowStore.get(windowKey);
      if (!live.hasFetchedInitial && !live.isFetchingInitial) ensureInitial();
      if (live.isFetchingInitial || live.isFetchingOlder) {
        return { ok: false, kind: "noop" as const };
      }

      if (live.before.length > 0) {
        chatMessageWindowStore.restoreOlderFromCache(windowKey, batch);
        return { ok: true, kind: "cache" as const };
      }

      const cursor = live.nextCursor;
      if (!cursor) return { ok: false, kind: "noop" as const };

      chatMessageWindowStore.setFetching(windowKey, { isFetchingOlder: true });
      try {
        const page = await fetchPage(cursor, "before", batch);
        chatMessageWindowStore.mergeOlderFromServer(
          windowKey,
          page.items ?? [],
          page.nextCursor ?? null,
        );
        return { ok: true, kind: "network" as const };
      } catch (e) {
        chatMessageWindowStore.setError(
          windowKey,
          e instanceof Error ? e.message : String(e),
        );
        return { ok: false, kind: "network" as const };
      }
    },
    [ensureInitial, fetchPage, windowKey],
  );

  const loadNewer = useCallback(
    async (batch = DEFAULT_BATCH) => {
      const live = chatMessageWindowStore.get(windowKey);
      if (live.isFetchingInitial || live.isFetchingNewer) {
        return { ok: false, kind: "noop" as const };
      }

      if (live.after.length > 0) {
        chatMessageWindowStore.restoreNewerFromCache(windowKey, batch);
        return { ok: true, kind: "cache" as const };
      }

      if (!live.hasMoreAfter) return { ok: false, kind: "noop" as const };

      const cursor = getNewestPersistedMessageId(live.messages);
      if (!cursor) return { ok: false, kind: "noop" as const };

      chatMessageWindowStore.setFetching(windowKey, { isFetchingNewer: true });
      try {
        const page = await fetchPage(cursor, "after", batch);
        const hasMoreAfterServer = Boolean(page.previousCursor);
        chatMessageWindowStore.mergeNewerFromServer(windowKey, page.items ?? [], {
          hasMoreAfter: hasMoreAfterServer,
          previousCursor: page.previousCursor ?? null,
        });
        return { ok: true, kind: "network" as const };
      } catch (e) {
        chatMessageWindowStore.setError(
          windowKey,
          e instanceof Error ? e.message : String(e),
        );
        return { ok: false, kind: "network" as const };
      }
    },
    [fetchPage, getNewestPersistedMessageId, windowKey],
  );

  const manageWindow = useCallback(
    (
      direction: "up" | "down",
      options?: { target?: number; hardMax?: number },
    ) => {
      const target = options?.target ?? 160;
      const hardMax = options?.hardMax ?? 200;
      const len = state.messages.length;
      if (len <= hardMax) return { evicted: 0, side: null as "top" | "bottom" | null };
      const evict = Math.max(0, len - target);
      if (evict === 0) return { evicted: 0, side: null as "top" | "bottom" | null };
      if (direction === "up") {
        chatMessageWindowStore.truncateBottomToAfter(windowKey, evict);
        return { evicted: evict, side: "bottom" as const };
      }
      chatMessageWindowStore.truncateTopToBefore(windowKey, evict);
      return { evicted: evict, side: "top" as const };
    },
    [state.messages.length, windowKey],
  );

  const jumpToPresent = useCallback(
    (keepCount: number) => {
      chatMessageWindowStore.jumpToPresent(windowKey, keepCount);
    },
    [windowKey],
  );

  const goToPresent = useCallback(
    async (keepCount: number) => {
      const live = chatMessageWindowStore.get(windowKey);
      const hadHistoricLike = live.hasMoreAfter || live.after.length > 0;
      const shouldVerifyPresent =
        live.needsCatchUp ||
        live.previousCursor != null ||
        (hadHistoricLike && live.afterWasAtEdge === false);

      chatMessageWindowStore.jumpToPresent(windowKey, keepCount);

      if (!shouldVerifyPresent) return { ok: true, kind: "cache" as const };

      const afterJump = chatMessageWindowStore.get(windowKey);
      if (
        afterJump.isFetchingInitial ||
        afterJump.isFetchingOlder ||
        afterJump.isFetchingNewer
      ) {
        return { ok: false, kind: "noop" as const };
      }

      chatMessageWindowStore.setFetching(windowKey, { isFetchingNewer: true });
      try {
        const page = await fetchPage(undefined, "before", keepCount);
        chatMessageWindowStore.seedInitial(
          windowKey,
          page.items ?? [],
          page.nextCursor ?? null,
        );
        return { ok: true, kind: "network" as const };
      } catch (e) {
        chatMessageWindowStore.setError(
          windowKey,
          e instanceof Error ? e.message : String(e),
        );
        return { ok: false, kind: "network" as const };
      }
    },
    [fetchPage, windowKey],
  );

  return {
    windowKey,
    status,
    error: state.error,
    messages: state.messages,
    compactById: state.compactById,
    compactRevision: state.compactRevision,
    beforeCount: state.beforeCount,
    afterCount: state.afterCount,
    hasMoreBefore,
    hasMoreAfter,
    isFetchingOlder: state.isFetchingOlder,
    isFetchingNewer: state.isFetchingNewer,
    ensureInitial,
    loadOlder,
    loadNewer,
    manageWindow,
    jumpToPresent,
    goToPresent,
  };
}
