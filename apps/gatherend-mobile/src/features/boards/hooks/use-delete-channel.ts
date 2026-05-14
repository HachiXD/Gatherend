import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteChannel, type DeleteChannelInput } from "../api/delete-channel";
import { boardQueryKey } from "../queries";
import type { BoardWithData } from "../types/board";

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChannel,
    onMutate: async (input: DeleteChannelInput) => {
      await queryClient.cancelQueries({
        queryKey: boardQueryKey(input.boardId),
      });

      const previousBoard = queryClient.getQueryData<BoardWithData>(
        boardQueryKey(input.boardId),
      );

      queryClient.setQueryData<BoardWithData>(
        boardQueryKey(input.boardId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            channels: old.channels.filter((ch) => ch.id !== input.channelId),
          };
        },
      );

      return { previousBoard };
    },
    onError: (_err, input, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(
          boardQueryKey(input.boardId),
          context.previousBoard,
        );
      }
    },
    onSettled: (_data, _err, input) => {
      void queryClient.invalidateQueries({
        queryKey: boardQueryKey(input.boardId),
      });
    },
  });
}
