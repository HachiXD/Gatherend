import { create } from "zustand";

const pendingReads = new Set<string>();
export const addPendingRead = (roomId: string) => pendingReads.add(roomId);
export const removePendingRead = (roomId: string) => pendingReads.delete(roomId);

interface ChannelSidebarState {
  channelId: string;
  unreadCount: number;
  lastReadSeq: number;
}

interface UnreadState {
  unreads: Record<string, number>;
  dmUnreads: Record<string, number>;
  lastAck: Record<string, number>;
  viewingRoom: string | null;
  addUnread: (roomId: string, messageMarker?: number) => void;
  addDmUnread: (roomId: string, messageTimestamp?: number) => void;
  clearUnread: (roomId: string) => void;
  clearDmUnread: (roomId: string) => void;
  clearBoardUnreads: (channelIds: string[]) => void;
  hasBoardUnreads: (_boardId: string, channelIds: string[]) => boolean;
  getUnreadCount: (roomId: string) => number;
  initializeFromServer: (unreadCounts: Record<string, number>) => void;
  replaceFromServer: (unreadCounts: Record<string, number>) => void;
  initializeDmFromServer: (unreadCounts: Record<string, number>) => void;
  replaceDmFromServer: (unreadCounts: Record<string, number>) => void;
  initializeChannelStateFromServer: (states: ChannelSidebarState[]) => void;
  replaceChannelStateFromServer: (states: ChannelSidebarState[]) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  setViewingRoom: (roomId: string | null) => void;
  setLastAck: (roomId: string, marker?: number) => void;
  shouldMarkUnread: (roomId: string, messageMarker?: number) => boolean;
}

function buildChannelState(
  state: Pick<UnreadState, "lastAck" | "viewingRoom" | "unreads">,
  channelStates: ChannelSidebarState[],
  replace: boolean,
) {
  const nextUnreads = replace ? {} : { ...state.unreads };
  const nextLastAck = { ...state.lastAck };

  for (const channelState of channelStates) {
    if (
      state.viewingRoom === channelState.channelId ||
      pendingReads.has(channelState.channelId)
    ) {
      nextLastAck[channelState.channelId] = Math.max(
        nextLastAck[channelState.channelId] || 0,
        channelState.lastReadSeq,
      );
      continue;
    }

    if (channelState.unreadCount > 0) {
      nextUnreads[channelState.channelId] = channelState.unreadCount;
    } else {
      delete nextUnreads[channelState.channelId];
    }

    nextLastAck[channelState.channelId] = channelState.lastReadSeq;
  }

  return {
    unreads: nextUnreads,
    lastAck: nextLastAck,
  };
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreads: {},
  dmUnreads: {},
  lastAck: {},
  viewingRoom: null,

  shouldMarkUnread: (roomId, messageMarker) => {
    const state = get();
    const lastAck = state.lastAck[roomId] || 0;
    const isViewing = state.viewingRoom === roomId;
    const marker = messageMarker || 0;

    return !isViewing && marker > lastAck;
  },

  addUnread: (roomId, messageMarker) =>
    set((state) => {
      const lastAck = state.lastAck[roomId] || 0;
      const isViewing = state.viewingRoom === roomId;
      const marker = messageMarker || 0;

      if (isViewing || marker <= lastAck) return state;

      return {
        unreads: {
          ...state.unreads,
          [roomId]: (state.unreads[roomId] || 0) + 1,
        },
      };
    }),

  addDmUnread: (roomId, messageTimestamp) =>
    set((state) => {
      const lastAck = state.lastAck[roomId] || 0;
      const isViewing = state.viewingRoom === roomId;
      const msgTime = messageTimestamp || Date.now();

      if (isViewing || msgTime <= lastAck) return state;

      return {
        dmUnreads: {
          ...state.dmUnreads,
          [roomId]: (state.dmUnreads[roomId] || 0) + 1,
        },
      };
    }),

  clearUnread: (roomId) =>
    set((state) => {
      const newUnreads: Record<string, number> = { ...state.unreads };
      delete newUnreads[roomId];
      return { unreads: newUnreads };
    }),

  clearDmUnread: (roomId) =>
    set((state) => {
      const newDmUnreads: Record<string, number> = { ...state.dmUnreads };
      delete newDmUnreads[roomId];
      return { dmUnreads: newDmUnreads };
    }),

  clearBoardUnreads: (channelIds) =>
    set((state) => {
      const newUnreads = { ...state.unreads };
      const newDmUnreads = { ...state.dmUnreads };
      channelIds.forEach((id) => {
        delete newUnreads[id];
        delete newDmUnreads[id];
      });
      return { unreads: newUnreads, dmUnreads: newDmUnreads };
    }),

  hasBoardUnreads: (_boardId, channelIds) => {
    const state = get();
    return channelIds.some((channelId) => state.unreads[channelId] > 0);
  },

  getUnreadCount: (roomId) => {
    const state = get();
    return state.unreads[roomId] || 0;
  },

  initializeFromServer: (unreadCounts) =>
    set((state) => {
      const filtered: Record<string, number> = {};
      for (const [id, count] of Object.entries(unreadCounts)) {
        if (state.viewingRoom === id || pendingReads.has(id)) continue;
        filtered[id] = count;
      }
      return { unreads: { ...state.unreads, ...filtered } };
    }),

  replaceFromServer: (unreadCounts) =>
    set((state) => {
      const filtered: Record<string, number> = {};
      for (const [id, count] of Object.entries(unreadCounts)) {
        if (state.viewingRoom === id || pendingReads.has(id)) continue;
        filtered[id] = count;
      }
      return { unreads: filtered };
    }),

  initializeDmFromServer: (unreadCounts) =>
    set((state) => {
      const filtered: Record<string, number> = {};
      for (const [id, count] of Object.entries(unreadCounts)) {
        if (state.viewingRoom === id || pendingReads.has(id)) continue;
        filtered[id] = count;
      }
      return { dmUnreads: { ...state.dmUnreads, ...filtered } };
    }),

  replaceDmFromServer: (unreadCounts) =>
    set((state) => {
      const filtered: Record<string, number> = {};
      for (const [id, count] of Object.entries(unreadCounts)) {
        if (state.viewingRoom === id || pendingReads.has(id)) continue;
        filtered[id] = count;
      }
      return { dmUnreads: filtered };
    }),

  initializeChannelStateFromServer: (states) =>
    set((state) => buildChannelState(state, states, false)),

  replaceChannelStateFromServer: (states) =>
    set((state) => buildChannelState(state, states, true)),

  setUnreadCount: (roomId, count) =>
    set((state) => {
      if (count === 0) {
        const newUnreads: Record<string, number> = { ...state.unreads };
        delete newUnreads[roomId];
        return { unreads: newUnreads };
      }
      return {
        unreads: {
          ...state.unreads,
          [roomId]: count,
        },
      };
    }),

  setViewingRoom: (roomId) => set(() => ({ viewingRoom: roomId })),

  setLastAck: (roomId, marker) =>
    set((state) => ({
      lastAck: {
        ...state.lastAck,
        [roomId]: marker || Date.now(),
      },
    })),
}));
