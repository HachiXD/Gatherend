import { create } from "zustand";

export interface VoiceParticipant {
  profileId: string;
  username: string;
  avatarUrl: string | null;
  usernameColor?: unknown;
}

interface VoiceParticipantsState {
  participants: Record<string, VoiceParticipant[]>;
  setParticipants: (
    channelId: string,
    participants: VoiceParticipant[],
  ) => void;
  addParticipant: (channelId: string, participant: VoiceParticipant) => void;
  removeParticipant: (channelId: string, profileId: string) => void;
  clearChannel: (channelId: string) => void;
}

const EMPTY_PARTICIPANTS: VoiceParticipant[] = [];

function sameParticipant(a: VoiceParticipant, b: VoiceParticipant) {
  return (
    a.profileId === b.profileId &&
    a.username === b.username &&
    a.avatarUrl === b.avatarUrl &&
    a.usernameColor === b.usernameColor
  );
}

export const useVoiceParticipantsStore = create<VoiceParticipantsState>(
  (set) => ({
    participants: {},

    setParticipants: (channelId, nextParticipants) => {
      set((state) => {
        const current = state.participants[channelId] ?? [];
        const unchanged =
          current.length === nextParticipants.length &&
          current.every((participant, index) =>
            sameParticipant(participant, nextParticipants[index]),
          );

        if (unchanged) return state;

        return {
          participants: {
            ...state.participants,
            [channelId]: nextParticipants,
          },
        };
      });
    },

    addParticipant: (channelId, participant) => {
      set((state) => {
        const current = state.participants[channelId] ?? [];
        const existingIndex = current.findIndex(
          (item) => item.profileId === participant.profileId,
        );

        if (existingIndex !== -1) {
          const merged = { ...current[existingIndex], ...participant };
          if (sameParticipant(current[existingIndex], merged)) return state;

          const updated = [...current];
          updated[existingIndex] = merged;
          return {
            participants: {
              ...state.participants,
              [channelId]: updated,
            },
          };
        }

        return {
          participants: {
            ...state.participants,
            [channelId]: [...current, participant],
          },
        };
      });
    },

    removeParticipant: (channelId, profileId) => {
      set((state) => {
        const current = state.participants[channelId] ?? [];
        const next = current.filter(
          (participant) => participant.profileId !== profileId,
        );

        if (next.length === current.length) return state;

        return {
          participants: {
            ...state.participants,
            [channelId]: next,
          },
        };
      });
    },

    clearChannel: (channelId) => {
      set((state) => {
        if (!state.participants[channelId]) return state;

        const nextParticipants = { ...state.participants };
        delete nextParticipants[channelId];
        return { participants: nextParticipants };
      });
    },
  }),
);

export const selectChannelParticipants =
  (channelId: string) =>
  (state: VoiceParticipantsState): VoiceParticipant[] =>
    state.participants[channelId] ?? EMPTY_PARTICIPANTS;

export const selectEmptyVoiceParticipants = (): VoiceParticipant[] =>
  EMPTY_PARTICIPANTS;
