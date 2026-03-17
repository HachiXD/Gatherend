"use client";

export interface FeedScrollState {
  key: string;
  windowStart: number;
  pageHeights: Record<number, number>;
  normalizedScrollTop: number;
  updatedAt: number;
}

const DEFAULT_STATE: FeedScrollState = {
  key: "__default__",
  windowStart: 0,
  pageHeights: {},
  normalizedScrollTop: 0,
  updatedAt: 0,
};

const store = new Map<string, FeedScrollState>();

function clonePageHeights(
  pageHeights: Record<number, number>,
): Record<number, number> {
  return { ...pageHeights };
}

export const feedScrollStore = {
  get(key: string): FeedScrollState {
    const existing = store.get(key);
    if (existing) {
      return {
        ...existing,
        pageHeights: clonePageHeights(existing.pageHeights),
      };
    }

    return {
      ...DEFAULT_STATE,
      key,
      pageHeights: {},
    };
  },

  set(state: FeedScrollState) {
    store.set(state.key, {
      ...state,
      pageHeights: clonePageHeights(state.pageHeights),
    });
  },

  clear(key: string) {
    store.delete(key);
  },
};
