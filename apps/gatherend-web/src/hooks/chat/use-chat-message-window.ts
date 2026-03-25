import { useCallback, useEffect, useMemo } from "react";
import qs from "query-string";
import { getExpressAuthHeaders } from "@/lib/express-fetch";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import type { ChatMessage } from "./types";
import {
  chatMessageWindowStore,
  useChatMessageWindowStoreSelector,
} from "./chat-message-window-store";

export type FetchDirection = "before" | "after";

const PERSISTED_MESSAGE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UseChatMessageWindowProps {
  windowKey: string;
  apiUrl: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  profileId: string;
  boardId?: string;
}

interface PageData {
  items: ChatMessage[];
  nextCursor: string | null;
  previousCursor: string | null;
}

interface BatchMessageData {
  items: ChatMessage[];
  missingIds: string[];
}

export interface ChatMessageWindowApi {
  windowKey: string;
  /**
   * We intentionally avoid a distinct "loading" state here.
   * The UI treats "idle" and "loading" the same (skeleton), and flipping a
   * "loading" flag causes an extra React commit without any DOM changes.
   */
  status: "idle" | "success" | "error";
  error: string | null;

  messages: ChatMessage[]; // oldest -> newest
  compactById: Record<string, boolean>;
  compactRevision: number;
  beforeCount: number;
  afterCount: number;

  hasMoreBefore: boolean; // server or cache
  hasMoreAfter: boolean; // Cache or server (present not mounted)

  isFetchingOlder: boolean;
  isFetchingNewer: boolean;

  // Actions
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

// Use 40 while evicting
// I suggest to not touch it, with 60 makes the mounted window shrink and produces large geometry restores
// (visible "jumps") when paging down via cache.
const DEFAULT_BATCH = 40;

const shallowEqual = <T extends Record<string, unknown>>(
  a: T,
  b: T,
): boolean => {
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
  apiUrl,
  paramKey,
  paramValue,
  profileId,
  boardId,
}: UseChatMessageWindowProps): ChatMessageWindowApi {
  const getToken = useTokenGetter();
  const state = useChatMessageWindowStoreSelector(
    windowKey,
    (s) => ({
      error: s.error,
      hasFetchedInitial: s.hasFetchedInitial,
      needsCatchUp: s.needsCatchUp,
      isFetchingInitial: s.isFetchingInitial,
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
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      const id = candidate?.id;
      if (typeof id === "string" && PERSISTED_MESSAGE_ID_REGEX.test(id)) {
        return id;
      }
    }
    return null;
  }, []);

  const getVisiblePersistedMessageIds = useCallback((messages: ChatMessage[]) => {
    return messages
      .map((message) => message.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && PERSISTED_MESSAGE_ID_REGEX.test(id),
      );
  }, []);

  const fetchPage = useCallback(
    async (
      cursor?: string,
      direction: FetchDirection = "before",
      limit: number = DEFAULT_BATCH,
    ): Promise<PageData> => {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query: {
          cursor,
          direction: cursor ? direction : undefined,
          limit,
          [paramKey]: paramValue,
          ...(boardId && { boardId }),
        },
      });

      const token = await getToken();
      const res = await fetch(url, {
        credentials: "include",
        headers: getExpressAuthHeaders(profileId, token),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      return res.json();
    },
    [apiUrl, boardId, getToken, paramKey, paramValue, profileId],
  );

  const fetchVisibleMessagesByIds = useCallback(
    async (ids: string[]): Promise<BatchMessageData> => {
      const url = qs.stringifyUrl({
        url: `${apiUrl}/by-ids`,
        query: {
          [paramKey]: paramValue,
          ...(boardId && { boardId }),
        },
      });

      const token = await getToken();
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getExpressAuthHeaders(profileId, token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch visible messages: ${res.status}`);
      }
      return res.json();
    },
    [apiUrl, boardId, getToken, paramKey, paramValue, profileId],
  );

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
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
      });
  }, [fetchPage, windowKey]);

  useEffect(() => {
    ensureInitial();
  }, [ensureInitial]);

  const recentCatchUpIfNeeded = useCallback(() => {
    const live = chatMessageWindowStore.get(windowKey);
    if (!live.needsCatchUp) return;
    if (
      live.isFetchingInitial ||
      live.isFetchingOlder ||
      live.isFetchingNewer
    ) {
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
        const nextHasMoreAfter = live.hasMoreAfter || serverHasMoreAfter;
        const nextPreviousCursor = serverHasMoreAfter
          ? (page.previousCursor ?? null)
          : live.previousCursor;

        chatMessageWindowStore.mergeNewerFromServer(
          windowKey,
          page.items ?? [],
          {
            hasMoreAfter: nextHasMoreAfter,
            previousCursor: nextPreviousCursor ?? null,
          },
        );
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
      });
  }, [ensureInitial, fetchPage, getNewestPersistedMessageId, windowKey]);

  const historicalCatchUpIfNeeded = useCallback(() => {
    const live = chatMessageWindowStore.get(windowKey);
    if (!live.needsCatchUp) return;
    if (
      live.isFetchingInitial ||
      live.isFetchingOlder ||
      live.isFetchingNewer
    ) {
      return;
    }

    if (!live.hasFetchedInitial || live.messages.length === 0) {
      ensureInitial();
      return;
    }

    const ids = getVisiblePersistedMessageIds(live.messages);
    if (ids.length === 0) {
      ensureInitial();
      return;
    }

    chatMessageWindowStore.setFetching(windowKey, { isFetchingNewer: true });

    void fetchVisibleMessagesByIds(ids)
      .then((data) => {
        chatMessageWindowStore.reconcileHistoricalCatchUpByIds(
          windowKey,
          data.items ?? [],
          data.missingIds ?? [],
        );
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
      });
  }, [
    ensureInitial,
    fetchVisibleMessagesByIds,
    getVisiblePersistedMessageIds,
    windowKey,
  ]);

  const catchUpIfNeeded = useCallback(() => {
    const live = chatMessageWindowStore.get(windowKey);
    if (!live.needsCatchUp) return;

    const isHistorical = live.hasMoreAfter || live.after.length > 0;
    if (isHistorical) {
      historicalCatchUpIfNeeded();
      return;
    }

    recentCatchUpIfNeeded();
  }, [historicalCatchUpIfNeeded, recentCatchUpIfNeeded, windowKey]);

  useEffect(() => {
    if (!state.needsCatchUp) return;
    catchUpIfNeeded();
  }, [catchUpIfNeeded, state.needsCatchUp]);

  const loadOlder = useCallback(
    async (batch: number = DEFAULT_BATCH) => {
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
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
        return { ok: false, kind: "network" as const };
      }
    },
    [ensureInitial, fetchPage, windowKey],
  );

  const loadNewer = useCallback(
    async (batch: number = DEFAULT_BATCH) => {
      const startState = chatMessageWindowStore.get(windowKey);
      if (startState.isFetchingInitial || startState.isFetchingNewer) {
        return { ok: false, kind: "noop" as const };
      }

      if (startState.after.length > 0) {
        chatMessageWindowStore.restoreNewerFromCache(windowKey, batch);
        const endState = chatMessageWindowStore.get(windowKey);
        return { ok: true, kind: "cache" as const };
      }

      if (!startState.hasMoreAfter) {
        return { ok: false, kind: "noop" as const };
      }

      const cursor = getNewestPersistedMessageId(startState.messages);
      if (!cursor) {
        return { ok: false, kind: "noop" as const };
      }

      chatMessageWindowStore.setFetching(windowKey, { isFetchingNewer: true });
      try {
        const page = await fetchPage(cursor, "after", batch);
        const hasMoreAfterServer = Boolean(page.previousCursor);
        chatMessageWindowStore.mergeNewerFromServer(
          windowKey,
          page.items ?? [],
          {
            hasMoreAfter: hasMoreAfterServer,
            previousCursor: page.previousCursor ?? null,
          },
        );
        const endState = chatMessageWindowStore.get(windowKey);
        return { ok: true, kind: "network" as const };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
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
      if (len <= hardMax)
        return { evicted: 0, side: null as "top" | "bottom" | null };

      const evict = Math.max(0, len - target);
      if (evict === 0)
        return { evicted: 0, side: null as "top" | "bottom" | null };

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

      if (!shouldVerifyPresent) {
        return { ok: true, kind: "cache" as const };
      }

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
        const msg = e instanceof Error ? e.message : String(e);
        chatMessageWindowStore.setError(windowKey, msg);
        return { ok: false, kind: "network" as const };
      }
    },
    [fetchPage, windowKey],
  );

  const fetching = chatMessageWindowStore.get(windowKey);

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
    isFetchingOlder: fetching.isFetchingOlder,
    isFetchingNewer: fetching.isFetchingNewer,
    ensureInitial,
    loadOlder,
    loadNewer,
    manageWindow,
    jumpToPresent,
    goToPresent,
  };
}
