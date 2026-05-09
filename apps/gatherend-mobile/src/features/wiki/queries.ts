export const wikiPagesQueryKey = (boardId: string, channelId?: string | null) =>
  ["wiki", "pages", boardId, channelId ?? "all"] as const;

export const wikiPageQueryKey = (
  boardId: string,
  pageId: string,
  channelId?: string | null,
) => ["wiki", "page", boardId, pageId, channelId ?? ""] as const;

export const WIKI_PAGES_STALE_TIME_MS = 1000 * 60;
export const WIKI_PAGES_GC_TIME_MS = 1000 * 60 * 5;

export const WIKI_PAGE_STALE_TIME_MS = 1000 * 60 * 2;
export const WIKI_PAGE_GC_TIME_MS = 1000 * 60 * 10;
