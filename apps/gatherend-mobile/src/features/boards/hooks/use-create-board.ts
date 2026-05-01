import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DISCOVERY_BOARDS_QUERY_KEY } from "@/src/features/discovery/queries";
import { createBoard } from "../api/create-board";
import { USER_BOARDS_QUERY_KEY } from "../queries";

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBoard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USER_BOARDS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: DISCOVERY_BOARDS_QUERY_KEY });
    },
  });
}
