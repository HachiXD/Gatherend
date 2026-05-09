import { create } from "zustand";

type BoardSection = "home" | "forum" | "wiki" | "chats" | "settings";
export type BoardHomeTab = "rules" | "chats" | "forum" | "featured" | "ranking";

type AppShellState = {
  isBoardDrawerOpen: boolean;
  lastBoardId: string | null;
  lastBoardSection: BoardSection;
  lastHomeTabByBoardId: Record<string, BoardHomeTab>;
  setIsBoardDrawerOpen: (isOpen: boolean) => void;
  setLastHomeTab: (boardId: string, tab: BoardHomeTab) => void;
  setLastBoardId: (boardId: string | null) => void;
  setLastBoardSection: (section: BoardSection) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  isBoardDrawerOpen: true,
  lastBoardId: null,
  lastBoardSection: "home",
  lastHomeTabByBoardId: {},
  setIsBoardDrawerOpen: (isOpen) =>
    set((state) =>
      state.isBoardDrawerOpen === isOpen
        ? state
        : { isBoardDrawerOpen: isOpen },
    ),
  setLastHomeTab: (boardId, tab) =>
    set((state) =>
      state.lastHomeTabByBoardId[boardId] === tab
        ? state
        : {
            lastHomeTabByBoardId: {
              ...state.lastHomeTabByBoardId,
              [boardId]: tab,
            },
          },
    ),
  setLastBoardId: (boardId) =>
    set((state) =>
      state.lastBoardId === boardId ? state : { lastBoardId: boardId },
    ),
  setLastBoardSection: (section) =>
    set((state) =>
      state.lastBoardSection === section ? state : { lastBoardSection: section },
    ),
}));
