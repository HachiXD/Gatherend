import { useCurrentBoardData } from "./use-board-data";
import type { BoardWithData } from "@/lib/boards/board-types";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";

interface UseBoardDataWithStalenessResult {
  /** Board data from React Query */
  board: BoardWithData | undefined;
  /** True if loading without cached data */
  isLoading: boolean;
  /** True if fetching in background */
  isFetching: boolean;
  /** True if cached data doesn't match current boardId */
  isStaleData: boolean;
  /** True if should show skeleton (loading or stale) */
  showSkeleton: boolean;
  /** Current board ID from context */
  currentBoardId: string;
}

/**
 * Hook that combines board data fetching with staleness detection.
 * Centralizes the logic that was previously duplicated across:
 * - BoardLeftbarClient
 * - BoardRightbarClient
 * - BoardMembersSection
 *
 * @returns Object with board data and loading/staleness states
 */
export function useBoardDataWithStaleness(): UseBoardDataWithStalenessResult {
  // Solo depender del boardId para evitar re-renders en navegación (discovery/channel/etc).
  const currentBoardId = useBoardNavigationStore((state) => state.currentBoardId);

  const { data: board, isLoading, isFetching, status, error } = useCurrentBoardData();

  // Data is stale if we have board data but it's from a different board
  const isStaleData = Boolean(board && board.id !== currentBoardId);

  // Show skeleton if:
  // 1. Loading without cached data
  // 2. Cached data is stale (from different board)
  const showSkeleton = (isLoading && !board) || isStaleData;


  return {
    board,
    isLoading,
    isFetching,
    isStaleData,
    showSkeleton,
    currentBoardId,
  };
}
