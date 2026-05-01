import { useMutation, useQueryClient } from "@tanstack/react-query";
import { boardQueryKey } from "@/src/features/boards/queries";
import type { BoardWithData } from "@/src/features/boards/types/board";
import { updateInviteCode, type InviteCodeAction } from "../api/update-invite-code";

export function useUpdateInviteCode(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: InviteCodeAction) => updateInviteCode(boardId, action),
    onSuccess: (updated) => {
      queryClient.setQueryData<BoardWithData>(
        boardQueryKey(boardId),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            inviteCode: updated.inviteCode,
            inviteEnabled: updated.inviteEnabled,
          };
        },
      );
    },
  });
}
