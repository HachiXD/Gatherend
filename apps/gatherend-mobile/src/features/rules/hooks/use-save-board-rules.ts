import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBoardRules } from "../api/save-board-rules";
import { boardRulesQueryKey } from "./use-board-rules";

export function useSaveBoardRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveBoardRules,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(boardRulesQueryKey(variables.boardId), data);
    },
  });
}
