import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type {
  BoardMember,
  BoardWithData,
} from "@/components/providers/board-provider";

export const BOARD_CACHE_STALE_TIME_MS = 1000 * 60 * 5;
export const BOARD_CACHE_GC_TIME_MS = 1000 * 60 * 5;

export const boardQueryKey = (boardId: string) => ["board", boardId] as const;
export const boardMembersQueryKey = (boardId: string) =>
  ["board-members", boardId] as const;

export interface BoardMembersPage {
  items: BoardMember[];
  members: BoardMember[];
  nextCursor: string | null;
  hasMore: boolean;
}

type BoardMembersInfiniteData = InfiniteData<BoardMembersPage, string | null>;
type BoardMemberUpdater = (member: BoardMember) => BoardMember;

function updateBoardMembersPages(
  old: BoardMembersInfiniteData | undefined,
  updateMember: (member: BoardMember) => BoardMember,
) {
  if (!old) return old;

  let changed = false;
  const pages = old.pages.map((page) => {
    const nextItems = page.items.map((member) => {
      const nextMember = updateMember(member);
      if (nextMember !== member) changed = true;
      return nextMember;
    });

    if (nextItems === page.items) return page;

    return {
      ...page,
      items: nextItems,
      members: nextItems,
    };
  });

  return changed ? { ...old, pages } : old;
}

export function patchBoardMemberInCache(
  queryClient: QueryClient,
  boardId: string,
  memberId: string,
  updater: BoardMemberUpdater,
) {
  queryClient.setQueriesData<BoardMembersInfiniteData>(
    { queryKey: boardMembersQueryKey(boardId) },
    (old) =>
      updateBoardMembersPages(old, (member) =>
        member.id === memberId ? updater(member) : member,
      ),
  );
}

export function patchBoardMemberByProfileIdInCache(
  queryClient: QueryClient,
  boardId: string,
  profileId: string,
  updater: BoardMemberUpdater,
) {
  queryClient.setQueriesData<BoardMembersInfiniteData>(
    { queryKey: boardMembersQueryKey(boardId) },
    (old) =>
      updateBoardMembersPages(old, (member) =>
        member.profileId === profileId ? updater(member) : member,
      ),
  );
}

export function removeBoardMemberFromCache(
  queryClient: QueryClient,
  boardId: string,
  target: { memberId?: string; profileId?: string },
) {
  queryClient.setQueriesData<BoardMembersInfiniteData>(
    { queryKey: boardMembersQueryKey(boardId) },
    (old) => {
      if (!old) return old;

      let changed = false;
      const pages = old.pages.map((page) => {
        const nextItems = page.items.filter((member) => {
          const shouldRemove =
            (target.memberId !== undefined && member.id === target.memberId) ||
            (target.profileId !== undefined &&
              member.profileId === target.profileId);
          if (shouldRemove) changed = true;
          return !shouldRemove;
        });

        if (nextItems.length === page.items.length) return page;

        return {
          ...page,
          items: nextItems,
          members: nextItems,
        };
      });

      return changed ? { ...old, pages } : old;
    },
  );
}

export function patchBoardMemberWarningsInCache(
  queryClient: QueryClient,
  boardId: string,
  memberId: string,
  patch: Partial<
    Pick<BoardMember, "activeWarningCount" | "latestActiveWarningId">
  >,
) {
  patchBoardMemberInCache(queryClient, boardId, memberId, (member) => ({
    ...member,
    ...patch,
  }));
}

export function patchBoardMemberProfileInCache(
  queryClient: QueryClient,
  profileId: string,
  updater: (profile: BoardMember["profile"]) => BoardMember["profile"],
) {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: ["board-members"] })
    .forEach((query) => {
      queryClient.setQueryData<BoardMembersInfiniteData>(query.queryKey, (old) =>
        updateBoardMembersPages(old, (member) => {
          if (member.profile.id !== profileId) return member;
          const nextProfile = updater(member.profile);
          return nextProfile === member.profile
            ? member
            : { ...member, profile: nextProfile };
        }),
      );
    });
}

export function updateBoardShellMemberCount(
  queryClient: QueryClient,
  boardId: string,
  updater: (memberCount: number) => number,
) {
  queryClient.setQueryData<BoardWithData>(boardQueryKey(boardId), (old) => {
    if (!old) return old;
    return {
      ...old,
      memberCount: Math.max(0, updater(old.memberCount)),
    };
  });
}

export function removeBoardMembersCache(queryClient: QueryClient, boardId: string) {
  queryClient.removeQueries({ queryKey: boardMembersQueryKey(boardId) });
}

export function pruneOrphanBoardMembersQueries(queryClient: QueryClient) {
  const boardIds = new Set<string>();

  queryClient
    .getQueryCache()
    .findAll({ queryKey: ["board"] })
    .forEach((query) => {
      const boardId = query.queryKey[1];
      if (typeof boardId === "string" && query.state.data) {
        boardIds.add(boardId);
      }
    });

  queryClient
    .getQueryCache()
    .findAll({ queryKey: ["board-members"] })
    .forEach((query) => {
      const boardId = query.queryKey[1];
      if (typeof boardId === "string" && !boardIds.has(boardId)) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
}
