import { useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_BOARDS_QUERY_KEY } from "@/src/features/boards/queries";
import { joinBoardFromDiscovery } from "@/src/features/discovery/api/join-board-from-discovery";
import { DISCOVERY_BOARDS_QUERY_KEY } from "@/src/features/discovery/queries";

type ExploreBoardInput = {
  boardId: string;
  isMember: boolean;
};

export function useExploreBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, isMember }: ExploreBoardInput) => {
      if (isMember) {
        return { alreadyMember: true };
      }

      return joinBoardFromDiscovery(boardId);
    },
    onSuccess: async (_data, variables) => {
      if (variables.isMember) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USER_BOARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DISCOVERY_BOARDS_QUERY_KEY }),
      ]);
    },
  });
}
