"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { logger } from "@/lib/logger";
import { useNavigationStore } from "@/hooks/use-navigation-store";

// LocalStorage helpers para memoria de ultima vista por board
const LAST_BOARD_VIEW_STORAGE_KEY = "gatherend:lastBoardView:v2";
const MAX_LAST_BOARD_VIEW_ENTRIES = 20;

export type BoardViewTarget =
  | { kind: "forum" }
  | { kind: "rules" }
  | { kind: "channels:list" }
  | { kind: "channels:channel"; channelId: string };

// Sub-vistas dentro de la sección Chats
type ChatsViewTarget =
  | { kind: "channels:list" }
  | { kind: "channels:channel"; channelId: string };

// Entrada persistida por board: sección activa + última sub-vista de chats (independiente)
interface PersistedBoardEntry {
  updatedAt: number;
  activeSection: "forum" | "rules" | "channels";
  // Solo presente cuando el usuario ha visitado chats al menos una vez
  chatsView?: ChatsViewTarget;
}

function isChatsViewTarget(value: unknown): value is ChatsViewTarget {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ChatsViewTarget & { channelId?: unknown }>;
  if (candidate.kind === "channels:list") return true;
  return (
    candidate.kind === "channels:channel" &&
    typeof candidate.channelId === "string" &&
    candidate.channelId.length > 0
  );
}

function isPersistedBoardEntry(value: unknown): value is PersistedBoardEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedBoardEntry>;
  if (typeof candidate.updatedAt !== "number") return false;
  if (
    candidate.activeSection !== "forum" &&
    candidate.activeSection !== "rules" &&
    candidate.activeSection !== "channels"
  )
    return false;
  if (
    candidate.chatsView !== undefined &&
    !isChatsViewTarget(candidate.chatsView)
  )
    return false;
  return true;
}

function readLastBoardEntries(): Record<string, PersistedBoardEntry> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(LAST_BOARD_VIEW_STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry) =>
        isPersistedBoardEntry(entry[1]),
      ),
    ) as Record<string, PersistedBoardEntry>;
  } catch (error) {
    logger.warn("Failed to read last board views from localStorage:", error);
    return {};
  }
}

export function saveLastBoardViewForBoard(
  boardId: string,
  view: BoardViewTarget,
): void {
  if (typeof window === "undefined") return;
  try {
    const data = readLastBoardEntries();
    const existing = data[boardId];

    let activeSection: "forum" | "rules" | "channels";
    let chatsView: ChatsViewTarget | undefined = existing?.chatsView;

    if (view.kind === "forum") {
      activeSection = "forum";
    } else if (view.kind === "rules") {
      activeSection = "rules";
    } else if (view.kind === "channels:list") {
      activeSection = "channels";
      chatsView = { kind: "channels:list" };
    } else {
      activeSection = "channels";
      chatsView = { kind: "channels:channel", channelId: view.channelId };
    }

    data[boardId] = { updatedAt: Date.now(), activeSection, chatsView };

    const limitedEntries = Object.entries(data)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_LAST_BOARD_VIEW_ENTRIES);

    localStorage.setItem(
      LAST_BOARD_VIEW_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(limitedEntries)),
    );
  } catch (error) {
    logger.warn("Failed to save last board view to localStorage:", error);
  }
}

export function getLastBoardViewForBoard(
  boardId: string,
): BoardViewTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const entry = readLastBoardEntries()[boardId];
    if (!entry) return null;
    if (entry.activeSection === "forum") return { kind: "forum" };
    if (entry.activeSection === "rules") return { kind: "rules" };
    // channels: devuelve la última sub-vista de chats, o la lista como fallback
    return entry.chatsView ?? { kind: "channels:list" };
  } catch (error) {
    logger.warn("Failed to read last board view from localStorage:", error);
    return null;
  }
}

export function getLastChatsViewForBoard(
  boardId: string,
): BoardViewTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const entry = readLastBoardEntries()[boardId];
    // Devuelve la sub-vista de chats independientemente de la sección activa
    return entry?.chatsView ?? null;
  } catch (error) {
    logger.warn("Failed to read last chats view from localStorage:", error);
    return null;
  }
}

export function resolveLastBoardViewForBoard(boardId: string): BoardViewTarget {
  return getLastBoardViewForBoard(boardId) ?? { kind: "channels:list" };
}

// Types

interface NavigationState {
  currentBoardId: string;
  currentChannelId: string | null;
  currentConversationId: string | null;
  isDiscovery: boolean;
  isChannels: boolean;
  isForum: boolean;
  isRules: boolean;
}

type SwitchBoardOptions = {
  history?: "push" | "replace";
  persist?: boolean;
};

interface BoardNavigationStore extends NavigationState {
  // Initialization
  isInitialized: boolean;
  isClientNavigationEnabled: boolean;
  persistActiveDiscoveryScroll: (() => void) | null;

  // Actions
  initializeFromUrl: () => void;
  switchBoard: (
    boardId: string,
    channelId?: string,
    options?: SwitchBoardOptions,
  ) => void;
  switchBoardView: (
    boardId: string,
    view: BoardViewTarget,
    options?: SwitchBoardOptions,
  ) => void;
  switchChannel: (channelId: string) => void;
  switchConversation: (conversationId: string) => void;
  switchToDiscovery: () => void;
  switchToChannels: (boardId?: string) => void;
  switchToChannelList: (boardId?: string) => void;
  switchToForum: (boardId?: string) => void;
  switchToRules: (boardId?: string) => void;
  registerActiveDiscoveryScrollPersistence: (
    persist: (() => void) | null,
  ) => void;

  // Internal - for popstate sync
  _syncFromPopstate: (state: NavigationState) => void;
}

// URL Parser

function parseUrlToState(): NavigationState {
  if (typeof window === "undefined") {
    return {
      currentBoardId: "",
      currentChannelId: null,
      currentConversationId: null,
      isDiscovery: false,
      isChannels: false,
      isForum: false,
      isRules: false,
    };
  }

  const pathParts = window.location.pathname.split("/");
  const boardIndex = pathParts.indexOf("boards");

  if (boardIndex === -1 || !pathParts[boardIndex + 1]) {
    return {
      currentBoardId: "",
      currentChannelId: null,
      currentConversationId: null,
      isDiscovery: false,
      isChannels: false,
      isForum: false,
      isRules: false,
    };
  }

  const boardId = pathParts[boardIndex + 1];
  const state: NavigationState = {
    currentBoardId: boardId,
    currentChannelId: null,
    currentConversationId: null,
    isDiscovery: false,
    isChannels: false,
    isForum: false,
    isRules: false,
  };

  if (pathParts.indexOf("discovery") !== -1) {
    state.isDiscovery = true;
  } else if (pathParts.indexOf("channels") !== -1) {
    state.isChannels = true;
  } else if (pathParts.indexOf("rules") !== -1) {
    state.isRules = true;
  } else if (pathParts.indexOf("forum") !== -1) {
    state.isForum = true;
  } else {
    const roomsIndex = pathParts.indexOf("rooms");
    if (roomsIndex !== -1 && pathParts[roomsIndex + 1]) {
      state.currentChannelId = pathParts[roomsIndex + 1];
    } else {
      const conversationIndex = pathParts.indexOf("conversations");
      if (conversationIndex !== -1 && pathParts[conversationIndex + 1]) {
        state.currentConversationId = pathParts[conversationIndex + 1];
      }
    }
  }

  return state;
}

// Store

// Parse URL immediately on module load (client-side only)
const initialState: NavigationState =
  typeof window !== "undefined"
    ? parseUrlToState()
    : {
        currentBoardId: "",
        currentChannelId: null,
        currentConversationId: null,
        isDiscovery: false,
        isChannels: false,
        isForum: false,
        isRules: false,
      };

function getBoardViewFromNavigationState(
  state: NavigationState,
): BoardViewTarget | null {
  if (state.currentChannelId) {
    return { kind: "channels:channel", channelId: state.currentChannelId };
  }
  if (state.isChannels) return { kind: "channels:list" };
  if (state.isRules) return { kind: "rules" };
  if (state.isForum) return { kind: "forum" };
  return null;
}

function getNavigationStateForBoardView(
  boardId: string,
  view: BoardViewTarget,
): NavigationState {
  return {
    currentBoardId: boardId,
    currentChannelId:
      view.kind === "channels:channel" ? view.channelId : null,
    currentConversationId: null,
    isDiscovery: false,
    isChannels: view.kind === "channels:list",
    isForum: view.kind === "forum",
    isRules: view.kind === "rules",
  };
}

function getUrlForBoardView(boardId: string, view: BoardViewTarget): string {
  switch (view.kind) {
    case "forum":
      return `/boards/${boardId}/forum`;
    case "rules":
      return `/boards/${boardId}/rules`;
    case "channels:list":
      return `/boards/${boardId}/channels`;
    case "channels:channel":
      return `/boards/${boardId}/rooms/${view.channelId}`;
  }
}

function getHistoryStateForBoardView(
  boardId: string,
  view: BoardViewTarget,
): Record<string, unknown> {
  switch (view.kind) {
    case "forum":
      return { boardId, isForum: true };
    case "rules":
      return { boardId, isRules: true };
    case "channels:list":
      return { boardId, isChannels: true };
    case "channels:channel":
      return { boardId, channelId: view.channelId };
  }
}

export const useBoardNavigationStore = create<BoardNavigationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state parsed from URL immediately (no need to wait for effect)
    ...initialState,
    isInitialized: typeof window !== "undefined",
    isClientNavigationEnabled: false,
    persistActiveDiscoveryScroll: null,

    initializeFromUrl: () => {
      const state = get();
      // Keep store routing aligned with current URL on each provider mount.
      const urlState = parseUrlToState();
      const needsSync =
        !state.isInitialized ||
        state.currentBoardId !== urlState.currentBoardId ||
        state.currentChannelId !== urlState.currentChannelId ||
        state.currentConversationId !== urlState.currentConversationId ||
        state.isDiscovery !== urlState.isDiscovery ||
        state.isChannels !== urlState.isChannels ||
        state.isForum !== urlState.isForum ||
        state.isRules !== urlState.isRules;

      if (needsSync) {
        set({
          ...urlState,
          isInitialized: true,
        });
      }

      const urlView = getBoardViewFromNavigationState(urlState);
      if (urlState.currentBoardId && urlView) {
        saveLastBoardViewForBoard(urlState.currentBoardId, urlView);
      }

      if (state.isClientNavigationEnabled) return;

      // Enable client navigation after a tick (to allow hydration)
      setTimeout(() => {
        set({ isClientNavigationEnabled: true });
      }, 0);

      // Setup popstate listener once
      const handlePopState = (event: PopStateEvent) => {
        if (event.state?.boardId) {
          get()._syncFromPopstate({
            currentBoardId: event.state.boardId,
            currentChannelId: event.state.channelId || null,
            currentConversationId: event.state.conversationId || null,
            isDiscovery: event.state.isDiscovery || false,
            isChannels: event.state.isChannels || false,
            isForum: event.state.isForum || false,
            isRules: event.state.isRules || false,
          });
        } else {
          // Fallback: parse URL
          get()._syncFromPopstate(parseUrlToState());
        }
      };

      window.addEventListener("popstate", handlePopState);

      // Register navigation functions in the legacy navigation store
      // This allows components outside the provider (like modals) to navigate
      const actions = get();
      useNavigationStore.getState().registerNavigation({
        switchBoard: actions.switchBoard,
        switchBoardView: actions.switchBoardView,
      });
    },

    registerActiveDiscoveryScrollPersistence: (persist) => {
      set({ persistActiveDiscoveryScroll: persist });
    },

    switchBoardView: (boardId, view, options) => {
      const state = get();
      const nextState = getNavigationStateForBoardView(boardId, view);
      const isSameRoutingState =
        state.currentBoardId === nextState.currentBoardId &&
        state.currentChannelId === nextState.currentChannelId &&
        state.currentConversationId === nextState.currentConversationId &&
        state.isDiscovery === nextState.isDiscovery &&
        state.isChannels === nextState.isChannels &&
        state.isForum === nextState.isForum &&
        state.isRules === nextState.isRules;

      if (isSameRoutingState && options?.history !== "replace") return;
      if (state.isDiscovery) {
        state.persistActiveDiscoveryScroll?.();
      }

      set(nextState);

      if (options?.persist !== false) {
        saveLastBoardViewForBoard(boardId, view);
      }

      const targetUrl = getUrlForBoardView(boardId, view);
      const targetState = getHistoryStateForBoardView(boardId, view);
      const historyMode = options?.history ?? "push";
      const shouldReplace = historyMode === "replace";
      const isSamePath = window.location.pathname === targetUrl;
      const currentHistoryState = (window.history.state ?? {}) as Record<
        string,
        unknown
      >;
      const isSameHistoryState = Object.entries(targetState).every(
        ([key, value]) => currentHistoryState[key] === value,
      );

      if (!isSamePath) {
        if (shouldReplace) {
          window.history.replaceState(targetState, "", targetUrl);
        } else {
          window.history.pushState(targetState, "", targetUrl);
        }
      } else if (shouldReplace && !isSameHistoryState) {
        window.history.replaceState(
          { ...currentHistoryState, ...targetState },
          "",
          targetUrl,
        );
      }
    },

    switchBoard: (boardId, channelId, options) => {
      const view: BoardViewTarget = channelId
        ? { kind: "channels:channel", channelId }
        : resolveLastBoardViewForBoard(boardId);
      get().switchBoardView(boardId, view, options);
    },

    switchChannel: (channelId) => {
      const state = get();
      if (channelId === state.currentChannelId && !state.isDiscovery) return;
      get().switchBoardView(state.currentBoardId, {
        kind: "channels:channel",
        channelId,
      });
    },

    switchConversation: (conversationId) => {
      const state = get();
      if (conversationId === state.currentConversationId && !state.isDiscovery)
        return;
      if (state.isDiscovery) {
        state.persistActiveDiscoveryScroll?.();
      }

      set({
        currentConversationId: conversationId,
        currentChannelId: null,
        isDiscovery: false,
        isChannels: false,
        isForum: false,
        isRules: false,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, conversationId },
        "",
        `/boards/${state.currentBoardId}/conversations/${conversationId}`,
      );
    },

    switchToDiscovery: () => {
      const state = get();
      if (state.isDiscovery) return;

      set({
        currentChannelId: null,
        currentConversationId: null,
        isDiscovery: true,
        isChannels: false,
        isForum: false,
        isRules: false,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, isDiscovery: true },
        "",
        `/boards/${state.currentBoardId}/discovery`,
      );
    },

    switchToForum: (boardId?: string) => {
      const state = get();
      const targetBoardId = boardId ?? state.currentBoardId;
      get().switchBoardView(targetBoardId, { kind: "forum" });
    },

    switchToChannels: (boardId?: string) => {
      const state = get();
      const targetBoardId = boardId ?? state.currentBoardId;
      get().switchBoardView(
        targetBoardId,
        getLastChatsViewForBoard(targetBoardId) ?? { kind: "channels:list" },
      );
    },

    switchToChannelList: (boardId?: string) => {
      const state = get();
      const targetBoardId = boardId ?? state.currentBoardId;
      get().switchBoardView(targetBoardId, { kind: "channels:list" });
    },

    switchToRules: (boardId?: string) => {
      const state = get();
      const targetBoardId = boardId ?? state.currentBoardId;
      get().switchBoardView(targetBoardId, { kind: "rules" });
    },

    _syncFromPopstate: (newState) => {
      set(newState);
      const view = getBoardViewFromNavigationState(newState);
      if (newState.currentBoardId && view) {
        saveLastBoardViewForBoard(newState.currentBoardId, view);
      }
    },
  })),
);

// Selectors (for optimal re-render control)

/**
 * Selector for routing state only.
 * Components using this only re-render when navigation state changes.
 */
export const selectRouting = (state: BoardNavigationStore) => ({
  currentBoardId: state.currentBoardId,
  currentChannelId: state.currentChannelId,
  currentConversationId: state.currentConversationId,
  isDiscovery: state.isDiscovery,
  isChannels: state.isChannels,
  isForum: state.isForum,
  isRules: state.isRules,
});

/**
 * Selector for navigation actions only.
 * These never change, so components using this never re-render from store changes.
 */
export const selectActions = (state: BoardNavigationStore) => ({
  switchBoard: state.switchBoard,
  switchBoardView: state.switchBoardView,
  switchChannel: state.switchChannel,
  switchConversation: state.switchConversation,
  switchToDiscovery: state.switchToDiscovery,
  switchToChannels: state.switchToChannels,
  switchToChannelList: state.switchToChannelList,
  switchToForum: state.switchToForum,
  switchToRules: state.switchToRules,
  isClientNavigationEnabled: state.isClientNavigationEnabled,
});

/**
 * Individual selectors for maximum granularity
 */
export const selectCurrentBoardId = (state: BoardNavigationStore) =>
  state.currentBoardId;
export const selectCurrentChannelId = (state: BoardNavigationStore) =>
  state.currentChannelId;
export const selectCurrentConversationId = (state: BoardNavigationStore) =>
  state.currentConversationId;
export const selectIsDiscovery = (state: BoardNavigationStore) =>
  state.isDiscovery;
export const selectIsChannels = (state: BoardNavigationStore) =>
  state.isChannels;
export const selectIsForum = (state: BoardNavigationStore) =>
  state.isForum;
export const selectIsInitialized = (state: BoardNavigationStore) =>
  state.isInitialized;
