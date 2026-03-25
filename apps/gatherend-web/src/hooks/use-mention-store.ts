import { create } from "zustand";

interface MentionState {
  // Menciones por roomId/channelId => tiene menciones no leídas
  mentions: Record<string, boolean>;

  // Añadir una mención no leída para un room
  addMention: (roomId: string) => void;

  // Limpiar las menciones de un room (cuando el usuario lo visita)
  clearMention: (roomId: string) => void;

  // Verificar si un room tiene menciones no leídas
  hasMention: (roomId: string) => boolean;

  // Verificar si algún canal de un board tiene menciones
  hasBoardMentions: (channelIds: string[]) => boolean;

  // Inicializar desde el servidor
  initializeFromServer: (roomIds: string[]) => void;
  replaceFromServer: (roomIds: string[]) => void;
}

export const useMentionStore = create<MentionState>((set, get) => ({
  mentions: {},

  addMention: (roomId) =>
    set((state) => ({
      mentions: {
        ...state.mentions,
        [roomId]: true,
      },
    })),

  clearMention: (roomId) =>
    set((state) => {
      const newMentions = { ...state.mentions };
      delete newMentions[roomId];
      return { mentions: newMentions };
    }),

  hasMention: (roomId) => {
    return get().mentions[roomId] === true;
  },

  hasBoardMentions: (channelIds) => {
    const state = get();
    return channelIds.some((channelId) => state.mentions[channelId] === true);
  },

  initializeFromServer: (roomIds) =>
    set((state) => {
      const newMentions: Record<string, boolean> = { ...state.mentions };
      roomIds.forEach((roomId) => {
        newMentions[roomId] = true;
      });
      return { mentions: newMentions };
    }),

  replaceFromServer: (roomIds) =>
    set(() => {
      const mentions: Record<string, boolean> = {};
      roomIds.forEach((roomId) => {
        mentions[roomId] = true;
      });
      return { mentions };
    }),
}));
