import { create } from "zustand";

type VoiceContext = "board" | "conversation";

interface VoiceState {
  channelId: string | null;
  channelName: string | null;
  context: VoiceContext | null;
  boardId: string | null;
  connectionAttemptId: number;

  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  isDeafened: boolean;
  errorMessage: string | null;

  startConnecting: (
    channelId: string,
    channelName: string,
    context: VoiceContext,
    boardId?: string,
  ) => void;
  confirmConnected: () => void;
  connectionFailed: () => void;
  leaveVoice: () => void;
  toggleDeafen: () => void;
  setReconnecting: (reconnecting: boolean) => void;
  setVoiceError: (message: string | null) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  channelId: null,
  channelName: null,
  context: null,
  boardId: null,
  connectionAttemptId: 0,
  isConnecting: false,
  isConnected: false,
  isReconnecting: false,
  isDeafened: false,
  errorMessage: null,

  startConnecting: (channelId, channelName, context, boardId) => {
    const state = get();
    if (
      state.channelId === channelId &&
      (state.isConnecting || state.isConnected)
    ) return;

    set({
      channelId,
      channelName,
      context,
      boardId: boardId ?? null,
      connectionAttemptId: state.connectionAttemptId + 1,
      isConnecting: true,
      isConnected: false,
      isReconnecting: false,
      errorMessage: null,
    });
  },

  confirmConnected: () => {
    const state = get();
    if ((state.isConnecting || state.isReconnecting) && state.channelId) {
      set({
        errorMessage: null,
        isConnecting: false,
        isConnected: true,
        isReconnecting: false,
      });
    }
  },

  connectionFailed: () =>
    set({
      channelId: null,
      channelName: null,
      context: null,
      boardId: null,
      isConnecting: false,
      isConnected: false,
      isReconnecting: false,
    }),

  leaveVoice: () =>
    set({
      channelId: null,
      channelName: null,
      context: null,
      boardId: null,
      isConnecting: false,
      isConnected: false,
      isReconnecting: false,
      errorMessage: null,
      isDeafened: false,
    }),

  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),

  setReconnecting: (reconnecting) => set({ isReconnecting: reconnecting }),

  setVoiceError: (message) => set({ errorMessage: message }),
}));
