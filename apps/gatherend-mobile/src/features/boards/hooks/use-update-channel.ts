import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateChannel, type UpdateChannelInput } from "../api/update-channel";
import { boardQueryKey } from "../queries";
import type { BoardWithData } from "../types/board";

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateChannel,
    onMutate: async (input: UpdateChannelInput) => {
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
            channels: old.channels.map((ch) =>
              ch.id === input.channelId ? { ...ch, name: input.name } : ch,
            ),
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
