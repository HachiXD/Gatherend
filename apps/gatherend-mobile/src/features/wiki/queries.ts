export const wikiPagesQueryKey = (boardId: string) =>
  ["wiki", "pages", boardId] as const;

export const wikiPageQueryKey = (boardId: string, pageId: string) =>
  ["wiki", "page", boardId, pageId] as const;

export const WIKI_PAGES_STALE_TIME_MS = 1000 * 60;
export const WIKI_PAGES_GC_TIME_MS = 1000 * 60 * 5;

export const WIKI_PAGE_STALE_TIME_MS = 1000 * 60 * 2;
export const WIKI_PAGE_GC_TIME_MS = 1000 * 60 * 10;
