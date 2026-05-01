export const USER_BOARDS_QUERY_KEY = ["user-boards"] as const;
export const boardQueryKey = (boardId: string) => ["board", boardId] as const;

export const USER_BOARDS_STALE_TIME_MS = 1000 * 60 * 5;
export const USER_BOARDS_GC_TIME_MS = 1000 * 60 * 5;
export const BOARD_STALE_TIME_MS = 1000 * 60 * 5;
export const BOARD_GC_TIME_MS = 1000 * 60 * 5;
