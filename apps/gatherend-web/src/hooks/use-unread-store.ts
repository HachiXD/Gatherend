import { create } from "zustand";

// Tracks the in-flight POST /read requests so the server-sync functions don't restore channels being marked as read
const pendingReads = new Set<string>();
export const addPendingRead = (roomId: string) => pendingReads.add(roomId);
export const removePendingRead = (roomId: string) => pendingReads.delete(roomId);

interface UnreadState {
  unreads: Record<string, number>;
  dmUnreads: Record<string, number>;
  lastAck: Record<string, number>;
  viewingRoom: string | null;
  addUnread: (roomId: string, messageTimestamp?: number) => void;
  addDmUnread: (roomId: string, messageTimestamp?: number) => void;
  clearUnread: (roomId: string) => void;
  clearDmUnread: (roomId: string) => void;
  clearBoardUnreads: (channelIds: string[]) => void;
  hasBoardUnreads: (boardId: string, channelIds: string[]) => boolean;
  getUnreadCount: (roomId: string) => number;
  initializeFromServer: (unreadCounts: Record<string, number>) => void;
  replaceFromServer: (unreadCounts: Record<string, number>) => void;
  initializeDmFromServer: (unreadCounts: Record<string, number>) => void;
  replaceDmFromServer: (unreadCounts: Record<string, number>) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  setViewingRoom: (roomId: string | null) => void;
  setLastAck: (roomId: string, timestamp?: number) => void;
  shouldMarkUnread: (roomId: string, messageTimestamp?: number) => boolean;
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreads: {},
  dmUnreads: {},
  lastAck: {},
  viewingRoom: null,

  // Verifica si debería marcar como unread (anti-race condition)
  shouldMarkUnread: (roomId, messageTimestamp) => {
    const state = get();
    const lastAck = state.lastAck[roomId] || 0;
    const isViewing = state.viewingRoom === roomId;
    const msgTime = messageTimestamp || Date.now();

    // No marcar si está viendo el room o si el mensaje es anterior al último ack
    return !isViewing && msgTime > lastAck;
  },

  addUnread: (roomId, messageTimestamp) =>
    set((state) => {
      const lastAck = state.lastAck[roomId] || 0;
      const isViewing = state.viewingRoom === roomId;
      const msgTime = messageTimestamp || Date.now();
      if (isViewing || msgTime <= lastAck) return state;
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
      return {
        unreads: newUnreads,
        lastAck: {
          ...state.lastAck,
          [roomId]: Date.now(),
        },
      };
    }),

  clearDmUnread: (roomId) =>
    set((state) => {
      const newDmUnreads: Record<string, number> = { ...state.dmUnreads };
      delete newDmUnreads[roomId];
      return {
        dmUnreads: newDmUnreads,
        lastAck: {
          ...state.lastAck,
          [roomId]: Date.now(),
        },
      };
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

  // Verifica si un board tiene unreads en cualquiera de sus canales
  hasBoardUnreads: (boardId, channelIds) => {
    const state = get();
    return channelIds.some((channelId) => state.unreads[channelId] > 0);
  },

  // Obtiene el contador de unreads para un canal/conversación
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

  // Establece el contador de unreads para un canal/conversación específico
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

  // Establece el room que el usuario está viendo actualmente
  setViewingRoom: (roomId) =>
    set((state) => {
      // Si estamos saliendo de un room (roomId es null o diferente), actualizar lastAck del room anterior
      if (state.viewingRoom && state.viewingRoom !== roomId) {
        return {
          viewingRoom: roomId,
          lastAck: {
            ...state.lastAck,
            [state.viewingRoom]: Date.now(),
          },
        };
      }
      return { viewingRoom: roomId };
    }),

  // Establece el timestamp de última lectura para un room
  setLastAck: (roomId, timestamp) =>
    set((state) => ({
      lastAck: {
        ...state.lastAck,
        [roomId]: timestamp || Date.now(),
      },
    })),
}));
