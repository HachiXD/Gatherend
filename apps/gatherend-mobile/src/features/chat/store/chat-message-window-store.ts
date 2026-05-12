import { useRef, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";
import {
  getMessageOwnerProfileId,
  isChannelMessage,
} from "@/src/features/chat/utils/message-author";

export interface ChatMessageWindowState {
  key: string;
  ready: boolean;
  hasFetchedInitial: boolean;
  /** Set on socket reconnect so the hook fetches messages missed during disconnect. */
  needsCatchUp: boolean;
  /** Append-only, oldest → newest. FlashList reads it reversed. */
  messages: ChatMessage[];
  compactById: Record<string, boolean>;
  compactRevision: number;
  /** Cursor for paginating older messages from the server (direction=before). */
  nextCursor: string | null;
  /** True when we jumped to a historical position and haven't reached the present edge yet. */
  hasMoreAfter: boolean;
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
  nextCursor: null,
  hasMoreAfter: false,
  isFetchingInitial: false,
  isFetchingOlder: false,
  isFetchingNewer: false,
  error: null,
  updatedAt: 0,
};

const store = new Map<string, ChatMessageWindowState>();
const listeners = new Map<string, Set<() => void>>();

/** Per-key GC timer. Fires after GC_TIME_MS of zero subscribers. */
const gcTimers = new Map<string, ReturnType<typeof setTimeout>>();
const GC_TIME_MS = 10 * 60 * 1000; // 10 minutes

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of set) l();
}

function getId(m: ChatMessage): string {
  return (m as { id: string }).id;
}

function mergeMessageUpdate(
  current: ChatMessage,
  update: Partial<ChatMessage>,
): ChatMessage {
  const merged = { ...(current as object), ...(update as object) } as ChatMessage;

  if ((update as { deleted?: unknown }).deleted !== true) {
    return merged;
  }

  return ({
    ...(merged as object),
    attachmentAsset: null,
    attachmentAssetId: null,
    content: "",
    deleted: true,
    reactions: [],
    sticker: null,
    stickerId: null,
  } as unknown) as ChatMessage;
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
  for (const m of state.messages) seen.add(getId(m));
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
  for (const m of next.messages) retainedIds.add(getId(m));

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

export const chatMessageWindowStore = {
  has(key: string): boolean {
    return store.has(key);
  },

  /** Called on socket reconnect so the hook fetches messages missed during disconnect. */
  markNeedsCatchUpIfExists(key: string) {
    if (!store.has(key)) return;
    chatMessageWindowStore.patch(key, (prev) => {
      if (prev.needsCatchUp) return prev;
      return { ...prev, needsCatchUp: true, updatedAt: Date.now() };
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
    // Cancel any pending GC for this key since a new subscriber arrived.
    const pendingTimer = gcTimers.get(key);
    if (pendingTimer !== undefined) {
      clearTimeout(pendingTimer);
      gcTimers.delete(key);
    }

    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);

    return () => {
      const current = listeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        listeners.delete(key);
        // Schedule store entry deletion after GC_TIME_MS with no subscribers.
        const t = setTimeout(() => {
          store.delete(key);
          gcTimers.delete(key);
        }, GC_TIME_MS);
        gcTimers.set(key, t);
      }
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
        if (prev.messages.length === 0) return prev;
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
        if (!changed) return prev;
        return {
          ...prev,
          messages: nextMessages,
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
    // Cancel pending GC timer and delete immediately.
    const t = gcTimers.get(key);
    if (t !== undefined) {
      clearTimeout(t);
      gcTimers.delete(key);
    }
    store.delete(key);
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

    // Preserve any optimistic messages inserted before the first server response.
    const optimistic = prev.messages.filter(isOptimisticMessage);
    dedupeAppend(messages, optimistic, seen);

    chatMessageWindowStore.commit(key, {
      key,
      ready: true,
      hasFetchedInitial: true,
      needsCatchUp: false,
      messages,
      compactById: {},
      compactRevision: 0,
      nextCursor,
      hasMoreAfter: false,
      isFetchingInitial: false,
      isFetchingOlder: false,
      isFetchingNewer: false,
      error: null,
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
      return {
        ...prev,
        ready: true,
        hasFetchedInitial: true,
        messages: [...prepend, ...prev.messages],
        nextCursor,
        isFetchingOlder: false,
        updatedAt: Date.now(),
      };
    });
  },

  mergeNewerFromServer(
    key: string,
    items: ChatMessage[],
    options?: { hasMoreAfter?: boolean },
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const normalized = normalizeServerItems(items);
      const seen = buildSeenSet(prev);
      const append: ChatMessage[] = [];
      dedupeAppend(append, normalized, seen);
      const hasMoreAfter = options?.hasMoreAfter ?? false;
      return {
        ...prev,
        ready: true,
        hasFetchedInitial: true,
        needsCatchUp: false,
        messages: [...prev.messages, ...append],
        hasMoreAfter,
        isFetchingNewer: false,
        updatedAt: Date.now(),
      };
    });
  },

  /**
   * Jump to present: keep only the newest `keepCount` messages and clear
   * hasMoreAfter. Used before re-seeding from the server when the user taps
   * the "Go to present" button.
   */
  jumpToPresent(key: string, keepCount: number) {
    chatMessageWindowStore.patch(key, (prev) => {
      const len = prev.messages.length;
      const start = Math.max(0, len - keepCount);
      return {
        ...prev,
        messages: prev.messages.slice(start),
        hasMoreAfter: false,
        updatedAt: Date.now(),
      };
    });
  },

  upsertIncomingMessage(key: string, message: ChatMessage) {
    chatMessageWindowStore.patch(key, (prev) => {
      const seen = buildSeenSet(prev);
      const id = (message as { id: string }).id;
      if (seen.has(id)) return prev;
      return {
        ...prev,
        ready: true,
        messages: [...prev.messages, message],
        updatedAt: Date.now(),
      };
    });
  },

  replaceOptimisticByTempId(
    key: string,
    tempId: string,
    serverMessage: ChatMessage,
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      let changed = false;
      const nextMessages = prev.messages.map((m) => {
        const t = (m as { tempId?: unknown }).tempId;
        const isOpt = (m as { isOptimistic?: unknown }).isOptimistic;
        if (isOpt === true && t === tempId) {
          changed = true;
          return serverMessage;
        }
        return m;
      });
      if (!changed) return prev;
      return {
        ...prev,
        ready: true,
        messages: nextMessages,
        updatedAt: Date.now(),
      };
    });
  },

  upsertById(
    key: string,
    message: Partial<ChatMessage> & { id: string },
    options?: { insertIfMissing?: boolean },
  ) {
    chatMessageWindowStore.patch(key, (prev) => {
      const id = message.id;
      let changed = false;
      const nextMessages = prev.messages.map((m) => {
        if ((m as { id: string }).id !== id) return m;
        changed = true;
        return mergeMessageUpdate(m, message);
      });
      if (changed) {
        return {
          ...prev,
          ready: true,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      }
      if (!options?.insertIfMissing) return prev;
      return {
        ...prev,
        ready: true,
        messages: [...prev.messages, message as ChatMessage],
        updatedAt: Date.now(),
      };
    });
  },

  removeById(key: string, id: string) {
    chatMessageWindowStore.patch(key, (prev) => {
      const nextMessages = prev.messages.filter(
        (m) => (m as { id: string }).id !== id,
      );
      if (nextMessages.length === prev.messages.length) return prev;
      return {
        ...prev,
        messages: nextMessages,
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
      const nextMessages = prev.messages.map((m) => {
        if ((m as { id: string }).id !== id) return m;
        changed = true;
        return updater(m);
      });
      if (!changed) return prev;
      return {
        ...prev,
        messages: nextMessages,
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
