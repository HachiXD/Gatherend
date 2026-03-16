"use client";

import { create } from "zustand";
import { JsonValue } from "@prisma/client/runtime/library";

export interface VoiceParticipant {
  profileId: string;
  username: string;
  avatarUrl: string | null;
  usernameColor?: JsonValue | string | null;
}

interface VoiceParticipantsState {
  // Map: channelId -> participants
  participants: Record<string, VoiceParticipant[]>;

  // Actions
  setParticipants: (
    channelId: string,
    participants: VoiceParticipant[]
  ) => void;
  addParticipant: (channelId: string, participant: VoiceParticipant) => void;
  updateParticipant: (channelId: string, participant: VoiceParticipant) => void;
  removeParticipant: (channelId: string, profileId: string) => void;
  clearChannel: (channelId: string) => void;
}

export const useVoiceParticipantsStore = create<VoiceParticipantsState>(
  (set) => ({
    participants: {},

    setParticipants: (channelId, newParticipants) => {
      set((state) => {

        const currentParticipants = state.participants[channelId] || [];
        if (currentParticipants.length === newParticipants.length) {
          let same = true;
          for (let i = 0; i < currentParticipants.length; i++) {
            const a = currentParticipants[i];
            const b = newParticipants[i];
            if (
              a.profileId !== b.profileId ||
              a.username !== b.username ||
              a.avatarUrl !== b.avatarUrl ||
              a.usernameColor !== b.usernameColor
            ) {
              same = false;
              break;
            }
          }
          if (same) {
            return state;
          }
        }
        return {
          participants: {
            ...state.participants,
            [channelId]: newParticipants,
          },
        };
      });
    },

    addParticipant: (channelId, participant) => {
      set((state) => {
        const currentParticipants = state.participants[channelId] || [];
        const existingIndex = currentParticipants.findIndex(
          (p) => p.profileId === participant.profileId
        );

        if (existingIndex !== -1) {
          // Ya existe - actualizar sus datos en lugar de ignorar
          const prev = currentParticipants[existingIndex];
          const merged = { ...prev, ...participant };

          // Avoid re-render churn when the duplicate event carries the same data.
          if (
            prev.profileId === merged.profileId &&
            prev.username === merged.username &&
            prev.avatarUrl === merged.avatarUrl &&
            prev.usernameColor === merged.usernameColor
          ) {
            return state;
          }

          const updated = [...currentParticipants];
          updated[existingIndex] = merged;
          return {
            participants: {
              ...state.participants,
              [channelId]: updated,
            },
          };
        }

        // No existe - agregar
        return {
          participants: {
            ...state.participants,
            [channelId]: [...currentParticipants, participant],
          },
        };
      });
    },

    updateParticipant: (channelId, participant) =>
      set((state) => {
        const currentParticipants = state.participants[channelId] || [];
        const existingIndex = currentParticipants.findIndex(
          (p) => p.profileId === participant.profileId
        );

        if (existingIndex === -1) {
          // No existe - no hacer nada
          return state;
        }

        // Actualizar
        const updated = [...currentParticipants];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...participant,
        };
        return {
          participants: {
            ...state.participants,
            [channelId]: updated,
          },
        };
      }),

    removeParticipant: (channelId, profileId) =>
      set((state) => {

        const currentParticipants = state.participants[channelId] || [];
        const filtered = currentParticipants.filter(
          (p) => p.profileId !== profileId
        );

        // Si no cambió nada, no actualizar
        if (filtered.length === currentParticipants.length) {
          return state;
        }

        // Create a completely new participants object to ensure React detects the change
        const newParticipants = { ...state.participants };
        newParticipants[channelId] = [...filtered];

        return {
          participants: newParticipants,
        };
      }),

    clearChannel: (channelId) =>
      set((state) => {
        const newParticipants = { ...state.participants };
        delete newParticipants[channelId];
        return { participants: newParticipants };
      }),
  })
);

// Selector helper para obtener participantes de un canal específico
export const selectChannelParticipants =
  (channelId: string) =>
  (state: VoiceParticipantsState): VoiceParticipant[] =>
    state.participants[channelId] ?? [];
