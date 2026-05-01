import { useQuery } from "@tanstack/react-query";
import { getUserBoards } from "../api/get-user-boards";
import {
  USER_BOARDS_GC_TIME_MS,
  USER_BOARDS_QUERY_KEY,
  USER_BOARDS_STALE_TIME_MS,
} from "../queries";
import type { UserBoard } from "../types/board";

export function useUserBoards() {
  return useQuery<UserBoard[]>({
    queryKey: USER_BOARDS_QUERY_KEY,
    queryFn: getUserBoards,
    staleTime: USER_BOARDS_STALE_TIME_MS,
    gcTime: USER_BOARDS_GC_TIME_MS,
  });
}
