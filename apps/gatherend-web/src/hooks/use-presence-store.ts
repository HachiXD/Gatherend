import { create } from "zustand";

interface PresenceState {
  onlineUsers: Set<string>; // Set de profileIds que están online
  setUserOnline: (profileId: string) => void;
  setUserOffline: (profileId: string) => void;
  isOnline: (profileId: string) => boolean;
  setPresence: (presenceMap: Record<string, boolean>) => void;
  // Nuevo: Marcar múltiples usuarios online a la vez (merge, no replace)
  mergePresence: (presenceMap: Record<string, boolean>) => void;
  // Nuevo: Limpiar todo el estado (Util en logout)
  clearPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set<string>(),

  setUserOnline: (profileId: string) => {
    const current = get().onlineUsers;
    if (current.has(profileId)) return;

    const next = new Set(current);
    next.add(profileId);
    set({ onlineUsers: next });
  },

  setUserOffline: (profileId: string) => {
    const current = get().onlineUsers;
    if (!current.has(profileId)) return;

    const next = new Set(current);
    next.delete(profileId);
    set({ onlineUsers: next });
  },

  isOnline: (profileId: string) => {
    return get().onlineUsers.has(profileId);
  },

  // setPresence: reemplaza todo el estado (usar con cuidado)
  setPresence: (presenceMap: Record<string, boolean>) => {
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

  // mergePresence: actualiza el estado sin borrar usuarios existentes
  // Esto es importante cuando múltiples componentes usan usePresence con diferentes listas
  mergePresence: (presenceMap: Record<string, boolean>) => {
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
    const current = get().onlineUsers;
    if (current.size === 0) return;
    set({ onlineUsers: new Set<string>() });
  },
}));
