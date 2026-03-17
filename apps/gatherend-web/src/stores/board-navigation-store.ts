"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { logger } from "@/lib/logger";
import { useNavigationStore } from "@/hooks/use-navigation-store";

// LocalStorage helpers para memoria de último channel por board

const LAST_CHANNEL_STORAGE_KEY = "gatherend:lastChannel";
const LAST_DISCOVERY_CONTEXT_STORAGE_KEY = "gatherend:lastDiscoveryContext";

function saveLastChannelForBoard(boardId: string, channelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_STORAGE_KEY);
    const data: Record<string, string> = stored ? JSON.parse(stored) : {};
    data[boardId] = channelId;
    localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logger.warn("Failed to save last channel to localStorage:", error);
  }
}

export function getLastChannelForBoard(boardId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_STORAGE_KEY);
    if (!stored) return null;
    const data: Record<string, string> = JSON.parse(stored);
    return data[boardId] || null;
  } catch (error) {
    logger.warn("Failed to read last channel from localStorage:", error);
    return null;
  }
}

type DiscoverySection = "boards" | "posts";

type LastDiscoveryContext =
  | {
      view: "feed";
    }
  | {
      view: "community";
      communityId: string;
      section: DiscoverySection;
    };

function getLastDiscoveryContext(): LastDiscoveryContext | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LAST_DISCOVERY_CONTEXT_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return null;

    if ("view" in parsed && parsed.view === "feed") {
      return { view: "feed" };
    }

    const communityId =
      "communityId" in parsed && typeof parsed.communityId === "string"
        ? parsed.communityId
        : null;
    const section =
      "section" in parsed &&
      (parsed.section === "boards" || parsed.section === "posts")
        ? parsed.section
        : null;

    if (!communityId || !section) return null;

    return { view: "community", communityId, section };
  } catch (error) {
    logger.warn("Failed to read last discovery context:", error);
    return null;
  }
}

function saveLastDiscoveryContext(context: LastDiscoveryContext): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LAST_DISCOVERY_CONTEXT_STORAGE_KEY,
      JSON.stringify(context),
    );
  } catch (error) {
    logger.warn("Failed to save last discovery context:", error);
  }
}

// Types

interface NavigationState {
  currentBoardId: string;
  currentChannelId: string | null;
  currentConversationId: string | null;
  currentCommunityId: string | null;
  currentCommunitySection: DiscoverySection;
  isDiscovery: boolean;
}

type SwitchBoardOptions = {
  history?: "push" | "replace";
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
  switchChannel: (channelId: string) => void;
  switchConversation: (conversationId: string) => void;
  switchToDiscovery: () => void;
  switchToCommunityBoards: (communityId: string) => void;
  switchToCommunityPosts: (communityId: string) => void;
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
        currentCommunityId: null,
        currentCommunitySection: "boards",
        isDiscovery: false,
      };
  }

  const pathParts = window.location.pathname.split("/");
  const boardIndex = pathParts.indexOf("boards");

  if (boardIndex === -1 || !pathParts[boardIndex + 1]) {
    return {
      currentBoardId: "",
      currentChannelId: null,
      currentConversationId: null,
      currentCommunityId: null,
      currentCommunitySection: "boards",
      isDiscovery: false,
    };
  }

  const boardId = pathParts[boardIndex + 1];
  const state: NavigationState = {
    currentBoardId: boardId,
    currentChannelId: null,
    currentConversationId: null,
    currentCommunityId: null,
    currentCommunitySection: "boards",
    isDiscovery: false,
  };

  const discoveryIndex = pathParts.indexOf("discovery");
  if (discoveryIndex !== -1) {
    state.isDiscovery = true;
    const communitiesIndex = pathParts.indexOf("communities");
    if (communitiesIndex !== -1 && pathParts[communitiesIndex + 1]) {
      state.currentCommunityId = pathParts[communitiesIndex + 1];
      state.currentCommunitySection =
        pathParts[communitiesIndex + 2] === "posts" ? "posts" : "boards";
    }
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
         currentCommunityId: null,
         currentCommunitySection: "boards",
         isDiscovery: false,
       };

export const useBoardNavigationStore = create<BoardNavigationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state parsed from URL immediately (no need to wait for effect)
    ...initialState,
    isInitialized: typeof window !== "undefined", // Already initialized if on client
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
        state.currentCommunityId !== urlState.currentCommunityId ||
        state.isDiscovery !== urlState.isDiscovery;

      if (needsSync) {
        set({
          ...urlState,
          isInitialized: true,
        });
      }

      if (urlState.isDiscovery && urlState.currentCommunityId) {
        saveLastDiscoveryContext({
          view: "community",
          communityId: urlState.currentCommunityId,
          section: urlState.currentCommunitySection,
        });
      } else if (urlState.isDiscovery) {
        saveLastDiscoveryContext({
          view: "feed",
        });
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
            currentCommunityId: event.state.communityId || null,
            currentCommunitySection:
              event.state.communitySection === "posts" ? "posts" : "boards",
            isDiscovery: event.state.isDiscovery || false,
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
      });

    },

    registerActiveDiscoveryScrollPersistence: (persist) => {
      set({ persistActiveDiscoveryScroll: persist });
    },

    switchBoard: (boardId, channelId, options) => {
      const state = get();
      if (boardId === state.currentBoardId && !channelId) return;
      if (state.isDiscovery) {
        state.persistActiveDiscoveryScroll?.();
      }

      set({
        currentBoardId: boardId,
        currentChannelId: channelId || null,
        currentConversationId: null,
        currentCommunityId: null,
        isDiscovery: false,
      });

      const targetUrl = channelId
        ? `/boards/${boardId}/rooms/${channelId}`
        : `/boards/${boardId}`;
      const targetState = channelId ? { boardId, channelId } : { boardId };
      const historyMode = options?.history ?? "push";
      const shouldReplace = historyMode === "replace";
      const isSamePath = window.location.pathname === targetUrl;
      const currentHistoryState = (window.history.state ?? {}) as Record<
        string,
        unknown
      >;
      const isSameHistoryState =
        currentHistoryState.boardId === boardId &&
        (channelId ? currentHistoryState.channelId === channelId : true);

      // Avoid duplicate history entries when URL was already updated optimistically.
      if (!isSamePath) {
        if (shouldReplace) {
          window.history.replaceState(targetState, "", targetUrl);
        } else {
          window.history.pushState(targetState, "", targetUrl);
        }
      } else if (shouldReplace) {
        // Keep history.state in sync even if path did not change, but avoid
        // redundant writes that overwrite Next's internal router state.
        if (!isSameHistoryState) {
          // Preserve Next's internal router fields (e.g. __NA / __PRIVATE_NEXTJS_INTERNALS_TREE)
          // so we don't trigger a follow-up replaceState from Next.
          const mergedState: Record<string, unknown> = {
            ...currentHistoryState,
            ...targetState,
          };
          window.history.replaceState(mergedState, "", targetUrl);
        }
      }
    },

    switchChannel: (channelId) => {
      const state = get();
      if (channelId === state.currentChannelId && !state.isDiscovery) return;
      if (state.isDiscovery) {
        state.persistActiveDiscoveryScroll?.();
      }

      set({
        currentChannelId: channelId,
        currentConversationId: null,
        isDiscovery: false,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, channelId },
        "",
        `/boards/${state.currentBoardId}/rooms/${channelId}`,
      );

      saveLastChannelForBoard(state.currentBoardId, channelId);
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
      });

      window.history.pushState(
        { boardId: state.currentBoardId, conversationId },
        "",
        `/boards/${state.currentBoardId}/conversations/${conversationId}`,
      );
    },

    switchToDiscovery: () => {
      const state = get();
      const lastDiscoveryContext = getLastDiscoveryContext();

      const isAtStoredDiscoveryContext =
        !!lastDiscoveryContext &&
        state.isDiscovery &&
        ((lastDiscoveryContext.view === "feed" && !state.currentCommunityId) ||
          (lastDiscoveryContext.view === "community" &&
            state.currentCommunityId === lastDiscoveryContext.communityId &&
            state.currentCommunitySection === lastDiscoveryContext.section));

      if (
        !lastDiscoveryContext ||
        lastDiscoveryContext.view === "feed" ||
        isAtStoredDiscoveryContext
      ) {
        if (state.isDiscovery && !state.currentCommunityId) return;

        set({
          currentChannelId: null,
          currentConversationId: null,
          currentCommunityId: null,
          currentCommunitySection: "boards",
          isDiscovery: true,
        });

        saveLastDiscoveryContext({
          view: "feed",
        });

        window.history.pushState(
          { boardId: state.currentBoardId, isDiscovery: true },
          "",
          `/boards/${state.currentBoardId}/discovery`,
        );
        return;
      }

      set({
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: lastDiscoveryContext.communityId,
        currentCommunitySection: lastDiscoveryContext.section,
        isDiscovery: true,
      });

      window.history.pushState(
        {
          boardId: state.currentBoardId,
          communityId: lastDiscoveryContext.communityId,
          communitySection: lastDiscoveryContext.section,
          isDiscovery: true,
        },
        "",
        `/boards/${state.currentBoardId}/discovery/communities/${lastDiscoveryContext.communityId}/${lastDiscoveryContext.section}`,
      );
    },

    switchToCommunityBoards: (communityId) => {
      const state = get();
      if (
        state.currentCommunityId === communityId &&
        state.currentCommunitySection === "boards"
      ) {
        return;
      }

      set({
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: communityId,
        currentCommunitySection: "boards",
        isDiscovery: true,
      });

      saveLastDiscoveryContext({
        view: "community",
        communityId,
        section: "boards",
      });

      window.history.pushState(
        {
          boardId: state.currentBoardId,
          communityId,
          communitySection: "boards",
          isDiscovery: true,
        },
        "",
        `/boards/${state.currentBoardId}/discovery/communities/${communityId}/boards`,
      );
    },

    switchToCommunityPosts: (communityId) => {
      const state = get();
      if (
        state.currentCommunityId === communityId &&
        state.currentCommunitySection === "posts"
      ) {
        return;
      }

      set({
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: communityId,
        currentCommunitySection: "posts",
        isDiscovery: true,
      });

      saveLastDiscoveryContext({
        view: "community",
        communityId,
        section: "posts",
      });

      window.history.pushState(
        {
          boardId: state.currentBoardId,
          communityId,
          communitySection: "posts",
          isDiscovery: true,
        },
        "",
        `/boards/${state.currentBoardId}/discovery/communities/${communityId}/posts`,
      );
    },

    _syncFromPopstate: (newState) => {
      set(newState);
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
  currentCommunityId: state.currentCommunityId,
  currentCommunitySection: state.currentCommunitySection,
  isDiscovery: state.isDiscovery,
});

/**
 * Selector for navigation actions only.
 * These never change, so components using this never re-render from store changes.
 */
export const selectActions = (state: BoardNavigationStore) => ({
  switchBoard: state.switchBoard,
  switchChannel: state.switchChannel,
  switchConversation: state.switchConversation,
  switchToDiscovery: state.switchToDiscovery,
  switchToCommunityBoards: state.switchToCommunityBoards,
  switchToCommunityPosts: state.switchToCommunityPosts,
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
export const selectIsInitialized = (state: BoardNavigationStore) =>
  state.isInitialized;
