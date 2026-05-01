import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteBoardRules } from "../api/delete-board-rules";
import { boardRulesQueryKey } from "./use-board-rules";

export function useDeleteBoardRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBoardRules,
    onSuccess: (_data, boardId) => {
      queryClient.setQueryData(boardRulesQueryKey(boardId), null);
    },
  });
}
