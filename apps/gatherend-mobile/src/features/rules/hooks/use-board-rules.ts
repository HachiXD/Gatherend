import { useQuery } from "@tanstack/react-query";
import { getBoardRules } from "../api/get-board-rules";

export const boardRulesQueryKey = (boardId: string) =>
  ["rules", boardId] as const;

export function useBoardRules(boardId: string | undefined) {
  return useQuery({
    queryKey: boardRulesQueryKey(boardId ?? ""),
    queryFn: () => getBoardRules(boardId!),
    enabled: !!boardId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
