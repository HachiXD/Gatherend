import { create } from "zustand";

type PresenceState = {
  onlineUsers: Set<string>;
  setUserOnline: (profileId: string) => void;
  setUserOffline: (profileId: string) => void;
  isOnline: (profileId: string) => boolean;
  setPresence: (presenceMap: Record<string, boolean>) => void;
  mergePresence: (presenceMap: Record<string, boolean>) => void;
  clearPresence: () => void;
};

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set<string>(),

  setUserOnline: (profileId) => {
    const current = get().onlineUsers;
    if (current.has(profileId)) return;

    const next = new Set(current);
    next.add(profileId);
    set({ onlineUsers: next });
  },

  setUserOffline: (profileId) => {
    const current = get().onlineUsers;
    if (!current.has(profileId)) return;

    const next = new Set(current);
    next.delete(profileId);
    set({ onlineUsers: next });
  },

  isOnline: (profileId) => get().onlineUsers.has(profileId),

  setPresence: (presenceMap) => {
    const current = get().onlineUsers;
    const next = new Set<string>();

    Object.entries(presenceMap).forEach(([profileId, isOnline]) => {
      if (isOnline) next.add(profileId);
    });

    if (next.size === current.size) {
      let isSame = true;
      for (const profileId of next) {
        if (!current.has(profileId)) {
          isSame = false;
          break;
        }
      }
      if (isSame) return;
    }

    set({ onlineUsers: next });
  },

  mergePresence: (presenceMap) => {
    const current = get().onlineUsers;
    let next: Set<string> | null = null;

    for (const [profileId, shouldBeOnline] of Object.entries(presenceMap)) {
      const isCurrentlyOnline = current.has(profileId);
      if (shouldBeOnline) {
        if (!isCurrentlyOnline) {
          next ??= new Set(current);
          next.add(profileId);
        }
      } else if (isCurrentlyOnline) {
        next ??= new Set(current);
        next.delete(profileId);
      }
    }

    if (!next) return;
    set({ onlineUsers: next });
  },

  clearPresence: () => {
    if (get().onlineUsers.size === 0) return;
    set({ onlineUsers: new Set<string>() });
  },
}));
