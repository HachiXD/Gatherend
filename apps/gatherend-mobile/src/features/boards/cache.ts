import { QueryClient } from "@tanstack/react-query";
import { USER_BOARDS_QUERY_KEY } from "./queries";
import type { BoardWithData, UserBoard } from "./types/board";

function upsertUserBoard(
  oldBoards: UserBoard[] | undefined,
  nextBoard: UserBoard,
): UserBoard[] {
  if (!oldBoards) {
    return [nextBoard];
  }

  const existingIndex = oldBoards.findIndex((board) => board.id === nextBoard.id);

  if (existingIndex === -1) {
    return [...oldBoards, nextBoard];
  }

  return oldBoards.map((board) =>
    board.id === nextBoard.id ? { ...board, ...nextBoard } : board,
  );
}

export function syncUserBoardFromBoardData(
  queryClient: QueryClient,
  board: BoardWithData,
) {
  const nextBoard: UserBoard = {
    id: board.id,
    name: board.name,
    imageAsset: board.imageAsset,
    bannerAsset: board.bannerAsset,
    channels: board.channels.map((channel) => ({ id: channel.id })),
  };

  queryClient.setQueryData<UserBoard[]>(USER_BOARDS_QUERY_KEY, (old) =>
    upsertUserBoard(old, nextBoard),
  );
}
