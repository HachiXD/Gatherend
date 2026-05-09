export type BoardPrimarySection = "home" | "forum" | "wiki" | "chats" | "settings";

export function getBoardDrawerPath(boardId: string) {
  return {
    pathname: "/boards/[boardId]" as const,
    params: { boardId },
  };
}

export function getBoardSectionPath(
  boardId: string,
  section: BoardPrimarySection,
) {
  return {
    pathname: `/boards/[boardId]/${section}` as const,
    params: { boardId },
  };
}
