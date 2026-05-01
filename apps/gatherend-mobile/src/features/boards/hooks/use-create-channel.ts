import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChannel, type CreateChannelInput } from "../api/create-channel";
import { boardQueryKey } from "../queries";
import type { BoardChannel, BoardWithData } from "../types/board";

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createChannel,
    onMutate: async (input: CreateChannelInput) => {
      await queryClient.cancelQueries({
        queryKey: boardQueryKey(input.boardId),
      });

      const previousBoard = queryClient.getQueryData<BoardWithData>(
        boardQueryKey(input.boardId),
      );

      const tempId = `temp-${Date.now()}`;
      const optimisticChannel: BoardChannel = {
        id: tempId,
        name: input.name,
        type: input.type,
        boardId: input.boardId,
        position: 999,
        imageAsset: null,
        channelMemberCount: 1,
        isJoined: true,
      };

      queryClient.setQueryData<BoardWithData>(
        boardQueryKey(input.boardId),
        (old) => {
          if (!old) return old;
          return { ...old, channels: [...old.channels, optimisticChannel] };
        },
      );

      return { previousBoard, tempId };
    },
    onSuccess: (newChannel, input, context) => {
      queryClient.setQueryData<BoardWithData>(
        boardQueryKey(input.boardId),
        (old) => {
          if (!old || !context?.tempId) return old;
          return {
            ...old,
            channels: [
              ...old.channels.filter(
                (ch) => ch.id !== context.tempId && ch.id !== newChannel.id,
              ),
              newChannel,
            ],
          };
        },
      );
    },
    onError: (_err, input, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(
          boardQueryKey(input.boardId),
          context.previousBoard,
        );
      }
    },
  });
}
