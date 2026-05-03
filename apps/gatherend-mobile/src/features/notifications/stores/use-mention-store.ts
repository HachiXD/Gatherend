import { create } from "zustand";
import { useUnreadStore } from "./use-unread-store";

interface MentionState {
  mentions: Record<string, boolean>;
  addMention: (roomId: string) => void;
  clearMention: (roomId: string) => void;
  clearBoardMentions: (channelIds: string[]) => void;
  hasMention: (roomId: string) => boolean;
  hasBoardMentions: (channelIds: string[]) => boolean;
  initializeFromServer: (roomIds: string[]) => void;
  replaceFromServer: (roomIds: string[]) => void;
}

export const useMentionStore = create<MentionState>((set, get) => ({
  mentions: {},

  addMention: (roomId) =>
    set((state) => ({
      mentions: { ...state.mentions, [roomId]: true },
    })),

  clearMention: (roomId) =>
    set((state) => {
      const newMentions = { ...state.mentions };
      delete newMentions[roomId];
      return { mentions: newMentions };
    }),

  clearBoardMentions: (channelIds) =>
    set((state) => {
      const newMentions = { ...state.mentions };
      channelIds.forEach((id) => delete newMentions[id]);
      return { mentions: newMentions };
    }),

  hasMention: (roomId) => get().mentions[roomId] === true,

  hasBoardMentions: (channelIds) => {
    const state = get();
    return channelIds.some((channelId) => state.mentions[channelId] === true);
  },

  initializeFromServer: (roomIds) =>
    set((state) => {
      const viewingRoom = useUnreadStore.getState().viewingRoom;
      const newMentions = { ...state.mentions };
      roomIds.forEach((roomId) => {
        if (roomId !== viewingRoom) newMentions[roomId] = true;
      });
      return { mentions: newMentions };
    }),

  replaceFromServer: (roomIds) =>
    set(() => {
      const viewingRoom = useUnreadStore.getState().viewingRoom;
      const mentions: Record<string, boolean> = {};
      roomIds.forEach((roomId) => {
        if (roomId !== viewingRoom) mentions[roomId] = true;
      });
      return { mentions };
    }),
}));
