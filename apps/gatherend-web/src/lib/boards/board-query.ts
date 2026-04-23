export const BOARD_CACHE_STALE_TIME_MS = 1000 * 60 * 5;
export const BOARD_CACHE_GC_TIME_MS = 1000 * 60 * 5;

export const boardQueryKey = (boardId: string) => ["board", boardId] as const;
export const boardMembersQueryKey = (boardId: string) =>
  ["board-members", boardId] as const;
