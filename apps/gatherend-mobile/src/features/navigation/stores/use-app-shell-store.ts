import { create } from "zustand";

type BoardSection = "home" | "forum" | "wiki" | "chats" | "settings";

type AppShellState = {
  lastBoardId: string | null;
  lastBoardSection: BoardSection;
  boardsTabBarReady: boolean;
  setLastBoardId: (boardId: string | null) => void;
  setLastBoardSection: (section: BoardSection) => void;
  setBoardsTabBarReady: (ready: boolean) => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  lastBoardId: null,
  lastBoardSection: "home",
  boardsTabBarReady: false,
  setLastBoardId: (boardId) =>
    set((state) =>
      state.lastBoardId === boardId ? state : { lastBoardId: boardId },
    ),
  setLastBoardSection: (section) =>
    set((state) =>
      state.lastBoardSection === section ? state : { lastBoardSection: section },
    ),
  setBoardsTabBarReady: (ready) =>
    set((state) =>
      state.boardsTabBarReady === ready ? state : { boardsTabBarReady: ready },
    ),
}));
