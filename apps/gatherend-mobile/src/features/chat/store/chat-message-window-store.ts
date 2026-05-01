import { useRef, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/src/features/chat/chat-message";
import {
  getMessageOwnerProfileId,
  isChannelMessage,
} from "@/src/features/chat/utils/message-author";

export interface ChatMessageWindowState {
  key: string;
  ready: boolean;
  hasFetchedInitial: boolean;
  needsCatchUp: boolean;
  messages: ChatMessage[]; // oldest -> newest
  compactById: Record<string, boolean>; // derived compact flag per mounted message id
  compactRevision: number;
  before: ChatMessage[]; // evicted older (oldest -> newest)
  after: ChatMessage[]; // evicted newer (oldest -> newest)
  nextCursor: string | null; // cursor for loading older from server
  previousCursor: string | null; // cursor for loading newer from server (direction=after)
  hasMoreAfter: boolean; // present not mounted (cache or server)
  afterWasAtEdge: boolean; // after cache contains the present edge
  isFetchingInitial: boolean;
  isFetchingOlder: boolean;
  isFetchingNewer: boolean;
  error: string | null;
  updatedAt: number;
}

const DEFAULT_STATE: ChatMessageWindowState = {
  key: "__default__",
  ready: false,
  hasFetchedInitial: false,
  needsCatchUp: false,
  messages: [],
  compactById: {},
  compactRevision: 0,
  before: [],
  after: [],
  nextCursor: null,
  previousCursor: null,
  hasMoreAfter: false,
  afterWasAtEdge: false,
  isFetchingInitial: false,
  isFetchingOlder: false,
  isFetchingNewer: false,
  error: null,
  updatedAt: 0,
};

const store = new Map<string, ChatMessageWindowState>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of set) l();
}

function getId(m: ChatMessage): string {
  return (m as { id: string }).id;
}

function normalizeServerItems(items: ChatMessage[]): ChatMessage[] {
  // Server pages are newest -> oldest; normalize to oldest -> newest.
  return [...items].reverse();
}

function dedupeAppend(
  base: ChatMessage[],
  incoming: ChatMessage[],
  seen: Set<string>,
) {
  for (const m of incoming) {
    const id = getId(m);
    if (seen.has(id)) continue;
    seen.add(id);
    base.push(m);
  }
}

function buildSeenSet(state: ChatMessageWindowState): Set<string> {
  const seen = new Set<string>();
  for (const m of state.before) seen.add(getId(m));
  for (const m of state.messages) seen.add(getId(m));
  for (const m of state.after) seen.add(getId(m));
  return seen;
}

function isOptimisticMessage(m: ChatMessage): boolean {
  return (m as { isOptimistic?: unknown }).isOptimistic === true;
}

const COMPACT_WINDOW_MS = 5 * 60 * 1000;

function isWelcomeMessage(m: ChatMessage): boolean {
  return "type" in m && (m as { type?: unknown }).type === "WELCOME";
}

function getSenderId(m: ChatMessage): string | null {
  return getMessageOwnerProfileId(m);
}

function patchProfileOnMessage(
  message: ChatMessage,
  profileId: string,
  patch: Record<string, unknown>,
): ChatMessage {
  let changed = false;

  const apply = <T extends Record<string, unknown>>(obj: T): T => {
    const next: Record<string, unknown> = { ...obj };
    let localChanged = false;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (Object.is(next[k], v)) continue;
      next[k] = v;
      localChanged = true;
    }
    if (localChanged) changed = true;
    return (localChanged ? (next as T) : obj) as T;
  };

  const nextMessageSender =
    isChannelMessage(message) && message.messageSender?.id === profileId
      ? apply(message.messageSender as Record<string, unknown>)
      : isChannelMessage(message)
        ? message.messageSender
        : undefined;

  const nextSender =
    !isChannelMessage(message) &&
    (message as { sender?: { id?: string } }).sender?.id === profileId
      ? apply((message as { sender: Record<string, unknown> }).sender)
      : !isChannelMessage(message)
        ? (message as { sender?: unknown }).sender
        : undefined;

  const replyTo = (message as { replyTo?: unknown }).replyTo as
    | Record<string, unknown>
    | null
    | undefined;
  const nextReplyTo = replyTo
    ? (() => {
        let replyChanged = false;
        let next = replyTo;

        if (
          (replyTo.messageSender as { id?: string } | undefined)?.id ===
          profileId
        ) {
          const patchedMessageSender = apply(
            replyTo.messageSender as Record<string, unknown>,
          );
          if (patchedMessageSender !== replyTo.messageSender) {
            replyChanged = true;
            next = { ...next, messageSender: patchedMessageSender };
          }
        }

        if (
          (replyTo.sender as { id?: string } | undefined)?.id === profileId
        ) {
          const patchedSender = apply(
            replyTo.sender as Record<string, unknown>,
          );
          if (patchedSender !== replyTo.sender) {
            replyChanged = true;
            next = { ...next, sender: patchedSender };
          }
        }

        const replyMember = replyTo.member as
          | { profile?: { id?: string } }
          | undefined;
        if (!replyTo.messageSender && replyMember?.profile?.id === profileId) {
          const patchedProfile = apply(
            replyMember.profile as Record<string, unknown>,
          );
          if (patchedProfile !== replyMember.profile) {
            replyChanged = true;
            next = {
              ...next,
              member: { ...(next.member as object), profile: patchedProfile },
            };
          }
        }

        if (replyChanged) changed = true;
        return next;
      })()
    : replyTo;

  const reactions = (message as { reactions?: unknown[] }).reactions;
  const nextReactions = Array.isArray(reactions)
    ? reactions.map((r) => {
        const reaction = r as { profile?: { id?: string } };
        if (reaction?.profile?.id !== profileId) return r;
        const patchedProfile = apply(
          reaction.profile as Record<string, unknown>,
        );
        if (patchedProfile === reaction.profile) return r;
        changed = true;
        return { ...reaction, profile: patchedProfile };
      })
    : reactions;

  if (!changed) return message;

  if (isChannelMessage(message)) {
    return {
      ...(message as object),
      ...(nextMessageSender ? { messageSender: nextMessageSender } : null),
      ...(nextReplyTo ? { replyTo: nextReplyTo } : null),
      ...(nextReactions ? { reactions: nextReactions } : null),
    } as ChatMessage;
  }

  return {
    ...(message as object),
    ...(nextSender ? { sender: nextSender } : null),
    ...(nextReplyTo ? { replyTo: nextReplyTo } : null),
    ...(nextReactions ? { reactions: nextReactions } : null),
  } as ChatMessage;
}

function computeCompactForIndex(
  messages: ChatMessage[],
  index: number,
): boolean {
  const current = messages[index];
  const prev = messages[index - 1];
  if (!current || !prev) return false;
  if (isWelcomeMessage(current) || isWelcomeMessage(prev)) return false;

  const currentSenderId = getSenderId(current);
  const prevSenderId = getSenderId(prev);
  if (!currentSenderId || !prevSenderId || currentSenderId !== prevSenderId) {
    return false;
  }

  const currentTimeMs = new Date(current.createdAt).getTime();
  const prevTimeMs = new Date(prev.createdAt).getTime();
  if (!Number.isFinite(currentTimeMs) || !Number.isFinite(prevTimeMs)) {
    return false;
  }

  return Math.abs(currentTimeMs - prevTimeMs) <= COMPACT_WINDOW_MS;
}

function computeCompactById(messages: ChatMessage[]): Record<string, boolean> {
  const compactById: Record<string, boolean> = {};
  for (let index = 0; index < messages.length; index += 1) {
    const current = messages[index];
    if (current) {
      compactById[getId(current)] = computeCompactForIndex(messages, index);
    }
  }
  return compactById;
}

function withDerivedCompactState(
  prev: ChatMessageWindowState | undefined,
  next: ChatMessageWindowState,
): ChatMessageWindowState {
  if (prev && prev.messages === next.messages) {
    if (
      next.compactById === prev.compactById &&
      next.compactRevision === prev.compactRevision
    ) {
      return next;
    }
    return {
      ...next,
      compactById: prev.compactById,
      compactRevision: prev.compactRevision,
    };
  }

  if (!prev) {
    return {
      ...next,
      compactById: computeCompactById(next.messages),
      compactRevision: 1,
    };
  }

  const retainedIds = new Set<string>();
  for (const m of next.before) retainedIds.add(getId(m));
  for (const m of next.messages) retainedIds.add(getId(m));
  for (const m of next.after) retainedIds.add(getId(m));

  const mergedCompactById: Record<string, boolean> = {};
  for (const id of retainedIds) {
    if (!(id in prev.compactById)) continue;
    mergedCompactById[id] = prev.compactById[id] ?? false;
  }

  for (let index = 0; index < next.messages.length; index += 1) {
    const message = next.messages[index];
    if (!message) continue;
    const id = getId(message);
    if (id in mergedCompactById) continue;
    mergedCompactById[id] = computeCompactForIndex(next.messages, index);
  }

  return {
    ...next,
    compactById: mergedCompactById,
    compactRevision: prev.compactRevision + 1,
  };
}

const CACHE_MAX = 400;
const WINDOW_TARGET = 160;
const WINDOW_TRUNCATE_CHUNK = 40;
const WINDOW_HARD_MAX = 200;

type WindowDirection = "up" | "down";

type CacheRestoreMeta = {
  restoredCount: number;
  reachedPresentFromCache?: boolean;
};

function trimBeforeCache(before: ChatMessage[]): {
  items: ChatMessage[];
  trimmed: number;
} {
  if (before.length <= CACHE_MAX) return { items: before, trimmed: 0 };
  const trimmed = before.length - CACHE_MAX;
  return { items: before.slice(before.length - CACHE_MAX), trimmed };
}

function trimAfterCache(after: ChatMessage[]): {
  items: ChatMessage[];
  trimmed: number;
} {
  if (after.length <= CACHE_MAX) return { items: after, trimmed: 0 };
  const trimmed = after.length - CACHE_MAX;
  // Keep messages closest to the current window (oldest in the after-buffer).
  return { items: after.slice(0, CACHE_MAX), trimmed };
}

function truncateTopToBeforeState(
  prev: ChatMessageWindowState,
  count: number,
): ChatMessageWindowState {
  const takeCount = Math.max(0, Math.min(count, prev.messages.length));
  if (takeCount === 0) return prev;
  const take = prev.messages.slice(0, takeCount);
  const remaining = prev.messages.slice(takeCount);
  const { items: nextBefore } = trimBeforeCache([...prev.before, ...take]);
  return { ...prev, before: nextBefore, messages: remaining };
}

function truncateBottomToAfterState(
  prev: ChatMessageWindowState,
  count: number,
): ChatMessageWindowState {
  const takeCount = Math.max(0, Math.min(count, prev.messages.length));
  if (takeCount === 0) return prev;
  const split = prev.messages.length - takeCount;
  const take = prev.messages.slice(split);
  const remaining = prev.messages.slice(0, split);
  const wasAtEdge = !prev.hasMoreAfter;
  const combinedAfter = [...take, ...prev.after];
  const trimmed = trimAfterCache(combinedAfter);
  const nextAfterWasAtEdge =
    trimmed.trimmed > 0 ? false : prev.afterWasAtEdge || wasAtEdge;
  return {
    ...prev,
    after: trimmed.items,
    messages: remaining,
    hasMoreAfter: true,
    afterWasAtEdge: nextAfterWasAtEdge,
  };
}

function enforceWindowBudget(
  prev: ChatMessageWindowState,
  direction: WindowDirection,
): ChatMessageWindowState {
  const len = prev.messages.length;
  if (len <= WINDOW_HARD_MAX) return prev;
  const evict = Math.max(0, len - WINDOW_TARGET);
  if (evict === 0) return prev;
  return direction === "up"
    ? truncateBottomToAfterState(prev, evict)
    : truncateTopToBeforeState(prev, evict);
}

function truncateAfterDirectionalLoad(
  prev: ChatMessageWindowState,
  direction: WindowDirection,
): ChatMessageWindowState {
  const len = prev.messages.length;
  if (len <= WINDOW_TARGET) return prev;
  return direction === "up"
    ? truncateBottomToAfterState(prev, WINDOW_TRUNCATE_CHUNK)
    : truncateTopToBeforeState(prev, WINDOW_TRUNCATE_CHUNK);
}

function restoreFromBeforeCacheState(
  prev: ChatMessageWindowState,
  count: number,
): { next: ChatMessageWindowState; meta: CacheRestoreMeta } {
  const takeCount = Math.max(0, Math.min(count, prev.before.length));
  if (takeCount === 0) {
    return { next: prev, meta: { restoredCount: 0 } };
  }
  const restored = prev.before.slice(prev.before.length - takeCount);
  const remainingBefore = prev.before.slice(0, prev.before.length - takeCount);
  const merged: ChatMessageWindowState = {
    ...prev,
    before: remainingBefore,
    messages: [...restored, ...prev.messages],
    updatedAt: Date.now(),
  };
  return {
    next: { ...truncateAfterDirectionalLoad(merged, "up"), updatedAt: Date.now() },
    meta: { restoredCount: takeCount },
  };
}

function computeHasMoreAfterAfterCacheRestore(
  prev: ChatMessageWindowState,
  remainingAfterLength: number,
): { hasMoreAfter: boolean; reachedPresentFromCache: boolean } {
  const reachedPresentFromCache =
    remainingAfterLength === 0 && prev.afterWasAtEdge;
  if (reachedPresentFromCache) {
    return { hasMoreAfter: false, reachedPresentFromCache: true };
  }
  const hasCachedAfter = remainingAfterLength > 0;
  const hadServerMoreAfter = prev.hasMoreAfter && prev.after.length === 0;
  return {
    hasMoreAfter: hasCachedAfter || hadServerMoreAfter || !prev.afterWasAtEdge,
    reachedPresentFromCache: false,
  };
}

function restoreFromAfterCacheState(
  prev: ChatMessageWindowState,
  count: number,
): { next: ChatMessageWindowState; meta: CacheRestoreMeta } {
  const takeCount = Math.max(0, Math.min(count, prev.after.length));
  if (takeCount === 0) {
    return {
      next: prev,
      meta: { restoredCount: 0, reachedPresentFromCache: false },
    };
  }
  const restored = prev.after.slice(0, takeCount);
  const remainingAfter = prev.after.slice(takeCount);
  const recomputed = computeHasMoreAfterAfterCacheRestore(
    prev,
    remainingAfter.length,
  );
  const merged: ChatMessageWindowState = {
    ...prev,
    after: remainingAfter,
    messages: [...prev.messages, ...restored],
    hasMoreAfter: recomputed.hasMoreAfter,
    afterWasAtEdge: remainingAfter.length > 0 ? prev.afterWasAtEdge : false,
    previousCursor: recomputed.reachedPresentFromCache
      ? null
      : prev.previousCursor,
    updatedAt: Date.now(),
  };
  return {
    next: { ...truncateAfterDirectionalLoad(merged, "down"), updatedAt: Date.now() },
    meta: {
      restoredCount: takeCount,
      reachedPresentFromCache: recomputed.reachedPresentFromCache,
    },
  };
}

export const chatMessageWindowStore = {
  has(key: string): boolean {
    return store.has(key);
  },

  markNeedsCatchUpIfExists(key: string) {
    if (!store.has(key)) return;
    chatMessageWindowStore.patch(key, (prev) => {
      if (prev.needsCatchUp) return prev;
      return { ...prev, needsCatchUp: true, updatedAt: Date.now() };
    });
  },

  invalidateAfterCacheForCatchUpIfExists(key: string) {
    if (!store.has(key)) return;
    chatMessageWindowStore.patch(key, (prev) => {
      if (prev.after.length === 0 && prev.afterWasAtEdge === false) return prev;
      return {
        ...prev,
        after: [],
        afterWasAtEdge: false,
        hasMoreAfter: true,
        updatedAt: Date.now(),
      };
    });
  },

  invalidateBeforeCacheForCatchUpIfExists(key: string) {
    if (!store.has(key)) return;
    chatMessageWindowStore.patch(key, (prev) => {
      if (prev.before.length === 0) return prev;
      const firstServerBackedVisible = prev.messages.find(
        (m) => !isOptimisticMessage(m),
      );
      const nextCursor = firstServerBackedVisible
        ? getId(firstServerBackedVisible)
        : prev.nextCursor;
      return { ...prev, before: [], nextCursor, updatedAt: Date.now() };
    });
  },

  get(key: string): ChatMessageWindowState {
    const existing = store.get(key);
    if (existing) return existing;
    // IMPORTANT: `useSyncExternalStore` compares snapshots with `Object.is`.
    // Returning a fresh object on every call causes infinite re-render loops.
    const created: ChatMessageWindowState = { ...DEFAULT_STATE, key };
    store.set(key, created);
    return created;
  },

  subscribe(key: string, listener: () => void) {
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => {
      const current = listeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) listeners.delete(key);
    };
  },

  commit(key: string, next: ChatMessageWindowState) {
    const prev = store.get(key);
    const normalizedNext = withDerivedCompactState(prev, next);
    if (prev === normalizedNext) return;
    store.set(key, normalizedNext);
    emit(key);
  },

  patch(
    key: string,
    updater: (prev: ChatMessageWindowState) => ChatMessageWindowState,
  ) {
    const prev = chatMessageWindowStore.get(key);
    const next = updater(prev);
    chatMessageWindowStore.commit(key, next);
  },

  patchProfile(profileId: string, patch: Record<string, unknown>) {
    if (!profileId || !patch || typeof patch !== "object") return;
    for (const key of store.keys()) {
      chatMessageWindowStore.patch(key, (prev) => {
        if (
          prev.messages.length === 0 &&
          prev.before.length === 0 &&
          prev.after.length === 0
        ) {
          return prev;
        }
        let changed = false;
        const patchArray = (arr: ChatMessage[]) => {
          if (arr.length === 0) return arr;
          let localChanged = false;
          const next = arr.map((m) => {
            const patched = patchProfileOnMessage(m, profileId, patch);
            if (patched !== m) localChanged = true;
            return patched;
          });
          if (localChanged) changed = true;
          return localChanged ? next : arr;
        };
        const nextMessages = patchArray(prev.messages);
        const nextBefore = patchArray(prev.before);
        const nextAfter = patchArray(prev.after);
        if (!changed) return prev;
        return {
          ...prev,
          messages: nextMessages,
          before: nextBefore,
          after: nextAfter,
          updatedAt: Date.now(),
        };
      });
    }
  },

  reset(key: string) {
    chatMessageWindowStore.commit(key, { ...DEFAULT_STATE, key });
  },

  deleteIfUnused(key: string) {
    const subs = listeners.get(key);
    if (subs && subs.size > 0) return;
    store.delete(key);
    listeners.delete(key);
  },

  setFetching(
    key: string,
    flags: Partial<
      Pick<
        ChatMessageWindowState,
        "isFetchingInitial" | "isFetchingOlder" | "isFetchingNewer"
      >
    >,
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const nextIsFetchingInitial =
        flags.isFetchingInitial ?? prev.isFetchingInitial;
      const nextIsFetchingOlder = flags.isFetchingOlder ?? prev.isFetchingOlder;
      const nextIsFetchingNewer = flags.isFetchingNewer ?? prev.isFetchingNewer;
      if (
        prev.isFetchingInitial === nextIsFetchingInitial &&
        prev.isFetchingOlder === nextIsFetchingOlder &&
        prev.isFetchingNewer === nextIsFetchingNewer &&
        prev.error === null
      ) {
        return prev;
      }
      return {
        ...prev,
        isFetchingInitial: nextIsFetchingInitial,
        isFetchingOlder: nextIsFetchingOlder,
        isFetchingNewer: nextIsFetchingNewer,
        error: null,
        updatedAt: Date.now(),
      };
    });
  },

  setError(key: string, error: string) {
    chatMessageWindowStore.patch(key, (prev) => {
      if (
        prev.isFetchingInitial === false &&
        prev.isFetchingOlder === false &&
        prev.isFetchingNewer === false &&
        prev.error === error
      ) {
        return prev;
      }
      return {
        ...prev,
        isFetchingInitial: false,
        isFetchingOlder: false,
        isFetchingNewer: false,
        error,
        updatedAt: Date.now(),
      };
    });
  },

  seedInitial(key: string, items: ChatMessage[], nextCursor: string | null) {
    const prev = chatMessageWindowStore.get(key);
    const normalized = normalizeServerItems(items);
    const seen = new Set<string>();
    const messages: ChatMessage[] = [];
    dedupeAppend(messages, normalized, seen);

    // Preserve optimistic messages inserted before the first server response.
    const optimistic = [
      ...prev.before.filter(isOptimisticMessage),
      ...prev.messages.filter(isOptimisticMessage),
      ...prev.after.filter(isOptimisticMessage),
    ];
    dedupeAppend(messages, optimistic, seen);

    const seeded: ChatMessageWindowState = {
      key,
      ready: true,
      hasFetchedInitial: true,
      needsCatchUp: false,
      messages,
      compactById: {},
      compactRevision: 0,
      before: [],
      after: [],
      nextCursor,
      previousCursor: null,
      hasMoreAfter: false,
      afterWasAtEdge: false,
      isFetchingInitial: false,
      isFetchingOlder: false,
      isFetchingNewer: false,
      error: null,
      updatedAt: Date.now(),
    };

    chatMessageWindowStore.commit(key, {
      ...truncateAfterDirectionalLoad(seeded, "down"),
      updatedAt: Date.now(),
    });
  },

  mergeOlderFromServer(
    key: string,
    items: ChatMessage[],
    nextCursor: string | null,
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const normalized = normalizeServerItems(items);
      const seen = buildSeenSet(prev);
      const prepend: ChatMessage[] = [];
      dedupeAppend(prepend, normalized, seen);
      if (prepend.length === 0 && nextCursor === prev.nextCursor) {
        return { ...prev, isFetchingOlder: false, updatedAt: Date.now() };
      }
      const merged: ChatMessageWindowState = {
        ...prev,
        ready: true,
        hasFetchedInitial: true,
        messages: [...prepend, ...prev.messages],
        nextCursor,
        isFetchingOlder: false,
        updatedAt: Date.now(),
      };
      return {
        ...truncateAfterDirectionalLoad(merged, "up"),
        updatedAt: Date.now(),
      };
    });
  },

  mergeNewerFromServer(
    key: string,
    items: ChatMessage[],
    options?: { hasMoreAfter?: boolean; previousCursor?: string | null },
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const normalized = normalizeServerItems(items);
      const seen = buildSeenSet(prev);
      const append: ChatMessage[] = [];
      dedupeAppend(append, normalized, seen);
      const hasMoreAfter = options?.hasMoreAfter ?? prev.hasMoreAfter;
      const previousCursor = options?.previousCursor ?? prev.previousCursor;
      const merged: ChatMessageWindowState = {
        ...prev,
        ready: true,
        hasFetchedInitial: true,
        needsCatchUp: false,
        messages: [...prev.messages, ...append],
        hasMoreAfter,
        previousCursor: hasMoreAfter ? previousCursor : null,
        afterWasAtEdge: false,
        isFetchingNewer: false,
        updatedAt: Date.now(),
      };
      return {
        ...truncateAfterDirectionalLoad(merged, "down"),
        updatedAt: Date.now(),
      };
    });
  },

  reconcileHistoricalCatchUpByIds(
    key: string,
    items: ChatMessage[],
    missingIds: string[],
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const fetchedById = new Map(items.map((item) => [getId(item), item]));
      const missingIdSet = new Set(missingIds);
      const hadHistoricLike = prev.hasMoreAfter || prev.after.length > 0;
      const hadBeforeCache = prev.before.length > 0;
      const nextMessages = prev.messages.flatMap((m) => {
        if (isOptimisticMessage(m)) return [m];
        const id = getId(m);
        if (missingIdSet.has(id)) return [];
        const updated = fetchedById.get(id);
        return updated ? [updated] : [m];
      });
      const firstServerBackedVisible = nextMessages.find(
        (m) => !isOptimisticMessage(m),
      );
      const nextCursor =
        hadBeforeCache && firstServerBackedVisible
          ? getId(firstServerBackedVisible)
          : prev.nextCursor;
      return {
        ...prev,
        ready: true,
        hasFetchedInitial: true,
        needsCatchUp: false,
        messages: nextMessages,
        before: [],
        after: [],
        nextCursor,
        previousCursor: hadHistoricLike ? prev.previousCursor : null,
        hasMoreAfter: hadHistoricLike,
        afterWasAtEdge: false,
        isFetchingNewer: false,
        updatedAt: Date.now(),
      };
    });
  },

  restoreOlderFromCache(key: string, count: number) {
    chatMessageWindowStore.patch(key, (prev) => {
      const restored = restoreFromBeforeCacheState(prev, count);
      return restored.next;
    });
  },

  restoreNewerFromCache(key: string, count: number) {
    chatMessageWindowStore.patch(key, (prev) => {
      const restored = restoreFromAfterCacheState(prev, count);
      return restored.next;
    });
  },

  truncateTopToBefore(key: string, count: number) {
    chatMessageWindowStore.patch(key, (prev) => ({
      ...truncateTopToBeforeState(prev, count),
      updatedAt: Date.now(),
    }));
  },

  truncateBottomToAfter(key: string, count: number) {
    chatMessageWindowStore.patch(key, (prev) => ({
      ...truncateBottomToAfterState(prev, count),
      updatedAt: Date.now(),
    }));
  },

  jumpToPresent(key: string, keepCount: number) {
    chatMessageWindowStore.patch(key, (prev) => {
      const combined =
        prev.after.length > 0
          ? [...prev.messages, ...prev.after]
          : prev.messages;
      const takeCount = Math.max(0, Math.min(keepCount, combined.length));
      const start = Math.max(0, combined.length - takeCount);
      const nextMessages = combined.slice(start);
      const older = combined.slice(0, start);
      const { items: nextBefore } = trimBeforeCache([...prev.before, ...older]);
      const hadHistoricLike = prev.hasMoreAfter || prev.after.length > 0;
      const shouldAssumeMoreAfterFromServer =
        prev.needsCatchUp || prev.previousCursor != null;
      const shouldAssumeMoreAfterFromCache =
        hadHistoricLike && prev.afterWasAtEdge === false;
      const nextHasMoreAfter =
        shouldAssumeMoreAfterFromServer || shouldAssumeMoreAfterFromCache;
      return {
        ...prev,
        ready: true,
        before: nextBefore,
        after: [],
        messages: nextMessages,
        hasMoreAfter: nextHasMoreAfter,
        afterWasAtEdge: false,
        previousCursor: nextHasMoreAfter ? prev.previousCursor : null,
        updatedAt: Date.now(),
      };
    });
  },

  upsertIncomingMessage(
    key: string,
    message: ChatMessage,
    options?: { preferAfterCache?: boolean },
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const seen = buildSeenSet(prev);
      const id = getId(message);
      if (seen.has(id)) return prev;
      if (options?.preferAfterCache) {
        const trimmed = trimAfterCache([...prev.after, message]);
        return {
          ...prev,
          ready: true,
          after: trimmed.items,
          hasMoreAfter: true,
          afterWasAtEdge: false,
          updatedAt: Date.now(),
        };
      }
      const merged: ChatMessageWindowState = {
        ...prev,
        ready: true,
        messages: [...prev.messages, message],
        updatedAt: Date.now(),
      };
      return { ...enforceWindowBudget(merged, "down"), updatedAt: Date.now() };
    });
  },

  replaceOptimisticByTempId(
    key: string,
    tempId: string,
    serverMessage: ChatMessage,
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const replaceIn = (arr: ChatMessage[]) => {
        let changed = false;
        const next = arr.map((m) => {
          const t = (m as { tempId?: unknown }).tempId;
          const isOpt = (m as { isOptimistic?: unknown }).isOptimistic;
          if (isOpt === true && t === tempId) {
            changed = true;
            return serverMessage;
          }
          return m;
        });
        return { changed, next };
      };
      const a = replaceIn(prev.messages);
      const b = replaceIn(prev.before);
      const c = replaceIn(prev.after);
      if (!a.changed && !b.changed && !c.changed) return prev;
      return {
        ...prev,
        ready: true,
        messages: a.next,
        before: b.next,
        after: c.next,
        updatedAt: Date.now(),
      };
    });
  },

  upsertById(
    key: string,
    message: ChatMessage,
    options?: { insertIfMissing?: boolean; preferAfterCache?: boolean },
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const id = getId(message);
      const replaceIn = (arr: ChatMessage[]) => {
        let changed = false;
        const next = arr.map((m) => {
          if (getId(m) !== id) return m;
          changed = true;
          return message;
        });
        return { changed, next };
      };
      const a = replaceIn(prev.messages);
      const b = replaceIn(prev.before);
      const c = replaceIn(prev.after);
      if (a.changed || b.changed || c.changed) {
        return {
          ...prev,
          ready: true,
          messages: a.next,
          before: b.next,
          after: c.next,
          updatedAt: Date.now(),
        };
      }
      if (!options?.insertIfMissing) return prev;
      if (options?.preferAfterCache) {
        const trimmed = trimAfterCache([...prev.after, message]);
        return {
          ...prev,
          ready: true,
          after: trimmed.items,
          hasMoreAfter: true,
          afterWasAtEdge: false,
          updatedAt: Date.now(),
        };
      }
      const merged: ChatMessageWindowState = {
        ...prev,
        ready: true,
        messages: [...prev.messages, message],
        updatedAt: Date.now(),
      };
      return { ...enforceWindowBudget(merged, "down"), updatedAt: Date.now() };
    });
  },

  removeById(key: string, id: string) {
    chatMessageWindowStore.patch(key, (prev) => {
      const beforeLen =
        prev.before.length + prev.messages.length + prev.after.length;
      const nextBefore = prev.before.filter((m) => getId(m) !== id);
      const nextMessages = prev.messages.filter((m) => getId(m) !== id);
      const nextAfter = prev.after.filter((m) => getId(m) !== id);
      const afterLen =
        nextBefore.length + nextMessages.length + nextAfter.length;
      if (afterLen === beforeLen) return prev;
      return {
        ...prev,
        before: nextBefore,
        messages: nextMessages,
        after: nextAfter,
        updatedAt: Date.now(),
      };
    });
  },

  updateById(
    key: string,
    id: string,
    updater: (prev: ChatMessage) => ChatMessage,
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      let changed = false;
      const mapArr = (arr: ChatMessage[]) =>
        arr.map((m) => {
          if (getId(m) !== id) return m;
          changed = true;
          return updater(m);
        });
      const nextMessages = mapArr(prev.messages);
      const nextBefore = mapArr(prev.before);
      const nextAfter = mapArr(prev.after);
      if (!changed) return prev;
      return {
        ...prev,
        messages: nextMessages,
        before: nextBefore,
        after: nextAfter,
        updatedAt: Date.now(),
      };
    });
  },
};

export function useChatMessageWindowStore(key: string): ChatMessageWindowState {
  const getSnapshot = () => chatMessageWindowStore.get(key);
  return useSyncExternalStore(
    (listener) => chatMessageWindowStore.subscribe(key, listener),
    getSnapshot,
    getSnapshot,
  );
}

export function useChatMessageWindowStoreSelector<T>(
  key: string,
  selector: (state: ChatMessageWindowState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const lastKeyRef = useRef<string | null>(null);
  const lastSelectionRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as unknown as T,
  });

  if (lastKeyRef.current !== key) {
    lastKeyRef.current = key;
    lastSelectionRef.current = { hasValue: false, value: undefined as unknown as T };
  }

  const getSnapshot = () => {
    const state = chatMessageWindowStore.get(key);
    const next = selector(state);
    const last = lastSelectionRef.current;
    if (last.hasValue && isEqual(last.value, next)) {
      return last.value;
    }
    lastSelectionRef.current = { hasValue: true, value: next };
    return next;
  };

  return useSyncExternalStore(
    (listener) => chatMessageWindowStore.subscribe(key, listener),
    getSnapshot,
    getSnapshot,
  );
}
