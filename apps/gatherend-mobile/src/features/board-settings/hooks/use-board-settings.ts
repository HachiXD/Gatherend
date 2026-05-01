import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_BOARDS_QUERY_KEY, boardQueryKey } from "@/src/features/boards/queries";
import type { BoardWithData, UserBoard } from "@/src/features/boards/types/board";
import {
  banBoardMember,
  deleteBoard,
  getBoardBans,
  getBoardMembers,
  getBoardModerationActions,
  kickBoardMember,
  refreshBoard,
  removeBoardWarning,
  unbanBoardMember,
  updateBoardMemberRole,
  updateBoardSettings,
  warnBoardMember,
  type UpdateBoardSettingsInput,
} from "../api/board-settings-api";
import type {
  BoardBansPage,
  BoardMembersPage,
  BoardMemberRole,
  BoardModerationActionsPage,
} from "../types";

export const boardMembersQueryKey = (boardId: string) =>
  ["board-settings-members", boardId] as const;
export const boardBansQueryKey = (boardId: string) =>
  ["board-settings-bans", boardId] as const;
export const boardModerationActionsQueryKey = (boardId: string) =>
  ["board-settings-moderation-actions", boardId] as const;

function patchMemberPage(
  page: BoardMembersPage,
  memberId: string,
  patch: (member: BoardMembersPage["items"][number]) => BoardMembersPage["items"][number],
) {
  const items = page.items.map((member) =>
    member.id === memberId ? patch(member) : member,
  );

  return { ...page, items, members: items };
}

function removeMemberFromPage(page: BoardMembersPage, memberId: string) {
  const items = page.items.filter((member) => member.id !== memberId);
  return { ...page, items, members: items };
}

export function useUpdateBoardSettings(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBoardSettingsInput) =>
      updateBoardSettings(boardId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<BoardWithData>(boardQueryKey(boardId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          name: updated.name,
          description: updated.description,
          imageAsset: updated.imageAsset,
          bannerAsset: updated.bannerAsset,
          inviteCode: updated.inviteCode,
          inviteEnabled: updated.inviteEnabled,
        };
      });

      queryClient.setQueryData<UserBoard[]>(USER_BOARDS_QUERY_KEY, (prev) =>
        prev?.map((board) =>
          board.id === boardId
            ? {
                ...board,
                name: updated.name,
                imageAsset: updated.imageAsset,
                bannerAsset: updated.bannerAsset,
              }
            : board,
        ),
      );
    },
  });
}

export function useRefreshBoard(boardId: string) {
  return useMutation({
    mutationFn: () => refreshBoard(boardId),
  });
}

export function useBoardSettingsMembers(boardId: string | undefined) {
  return useInfiniteQuery<
    BoardMembersPage,
    Error,
    InfiniteData<BoardMembersPage>,
    ReturnType<typeof boardMembersQueryKey>,
    string | null
  >({
    queryKey: boardMembersQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardMembers(boardId!, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(boardId),
    staleTime: 1000 * 60,
  });
}

export function useBoardSettingsBans(boardId: string | undefined) {
  return useInfiniteQuery<
    BoardBansPage,
    Error,
    InfiniteData<BoardBansPage>,
    ReturnType<typeof boardBansQueryKey>,
    string | null
  >({
    queryKey: boardBansQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardBans(boardId!, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(boardId),
    staleTime: 1000 * 60,
  });
}

export function useBoardModerationActions(boardId: string | undefined) {
  return useInfiniteQuery<
    BoardModerationActionsPage,
    Error,
    InfiniteData<BoardModerationActionsPage>,
    ReturnType<typeof boardModerationActionsQueryKey>,
    string | null
  >({
    queryKey: boardModerationActionsQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => getBoardModerationActions(boardId!, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(boardId),
    staleTime: 1000 * 60,
  });
}

export function useBoardMemberActions(boardId: string) {
  const queryClient = useQueryClient();

  const invalidateModerationData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: boardMembersQueryKey(boardId) }),
      queryClient.invalidateQueries({ queryKey: boardBansQueryKey(boardId) }),
      queryClient.invalidateQueries({
        queryKey: boardModerationActionsQueryKey(boardId),
      }),
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    ]);
  };

  const role = useMutation({
    mutationFn: ({ memberId, nextRole }: { memberId: string; nextRole: BoardMemberRole }) =>
      updateBoardMemberRole(boardId, memberId, nextRole),
    onSuccess: (_result, { memberId, nextRole }) => {
      queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
        boardMembersQueryKey(boardId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((page) =>
                  patchMemberPage(page, memberId, (member) => ({
                    ...member,
                    role: nextRole,
                  })),
                ),
              }
            : prev,
      );
    },
  });

  const kick = useMutation({
    mutationFn: ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => kickBoardMember(boardId, targetProfileId).then(() => memberId),
    onSuccess: (memberId) => {
      queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
        boardMembersQueryKey(boardId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((page) => removeMemberFromPage(page, memberId)),
              }
            : prev,
      );
      void queryClient.invalidateQueries({
        queryKey: boardModerationActionsQueryKey(boardId),
      });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    },
  });

  const ban = useMutation({
    mutationFn: ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => banBoardMember(boardId, targetProfileId).then(() => memberId),
    onSuccess: (memberId) => {
      queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
        boardMembersQueryKey(boardId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((page) => removeMemberFromPage(page, memberId)),
              }
            : prev,
      );
      void invalidateModerationData();
    },
  });

  const warn = useMutation({
    mutationFn: ({
      memberId,
      targetProfileId,
    }: {
      memberId: string;
      targetProfileId: string;
    }) => warnBoardMember(boardId, targetProfileId).then((result) => ({
      memberId,
      result,
    })),
    onSuccess: ({ memberId, result }) => {
      if (result.autoBanned) {
        queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
          boardMembersQueryKey(boardId),
          (prev) =>
            prev
              ? {
                  ...prev,
                  pages: prev.pages.map((page) => removeMemberFromPage(page, memberId)),
                }
              : prev,
        );
        void invalidateModerationData();
        return;
      }

      queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
        boardMembersQueryKey(boardId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((page) =>
                  patchMemberPage(page, memberId, (member) => ({
                    ...member,
                    activeWarningCount: member.activeWarningCount + 1,
                    latestActiveWarningId:
                      result.warning?.id ?? member.latestActiveWarningId,
                  })),
                ),
              }
            : prev,
      );
      void queryClient.invalidateQueries({
        queryKey: boardModerationActionsQueryKey(boardId),
      });
    },
  });

  const removeWarning = useMutation({
    mutationFn: ({
      memberId,
      warningId,
    }: {
      memberId: string;
      warningId: string;
    }) => removeBoardWarning(boardId, warningId).then(() => memberId),
    onSuccess: (memberId) => {
      queryClient.setQueryData<InfiniteData<BoardMembersPage>>(
        boardMembersQueryKey(boardId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((page) =>
                  patchMemberPage(page, memberId, (member) => ({
                    ...member,
                    activeWarningCount: Math.max(0, member.activeWarningCount - 1),
                    latestActiveWarningId: null,
                  })),
                ),
              }
            : prev,
      );
      void queryClient.invalidateQueries({
        queryKey: boardModerationActionsQueryKey(boardId),
      });
    },
  });

  return { role, kick, ban, warn, removeWarning };
}

export function useUnbanBoardMember(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => unbanBoardMember(boardId, profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: boardBansQueryKey(boardId) }),
        queryClient.invalidateQueries({
          queryKey: boardModerationActionsQueryKey(boardId),
        }),
      ]);
    },
  });
}

export function useDeleteBoard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteBoard(boardId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: boardQueryKey(boardId) });
      queryClient.setQueryData<UserBoard[]>(USER_BOARDS_QUERY_KEY, (prev) =>
        prev?.filter((board) => board.id !== boardId),
      );
      await queryClient.invalidateQueries({ queryKey: USER_BOARDS_QUERY_KEY });
    },
  });
}
