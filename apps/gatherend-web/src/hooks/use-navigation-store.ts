"use client";

import { create } from "zustand";
import type { BoardViewTarget } from "@/stores/board-navigation-store";

/**
 * Store global para navegación SPA
 *
 * Este store permite que componentes fuera del BoardSwitchProvider
 * (como modales) puedan triggear navegación SPA.
 *
 * El BoardSwitchProvider registra sus funciones de navegación aquí,
 * y otros componentes pueden llamarlas sin necesitar acceso directo al contexto.
 */

type SwitchBoardOptions = {
  history?: "push" | "replace";
  persist?: boolean;
};

interface NavigationState {
  // Función de navegación registrada por BoardSwitchProvider
  switchBoard: ((
    boardId: string,
    channelId?: string,
    options?: SwitchBoardOptions,
  ) => void) | null;
  switchBoardView: ((
    boardId: string,
    view: BoardViewTarget,
    options?: SwitchBoardOptions,
  ) => void) | null;

  // Registrar función (llamado por BoardSwitchProvider)
  registerNavigation: (fns: {
    switchBoard: (
      boardId: string,
      channelId?: string,
      options?: SwitchBoardOptions,
    ) => void;
    switchBoardView: (
      boardId: string,
      view: BoardViewTarget,
      options?: SwitchBoardOptions,
    ) => void;
  }) => void;

  // Limpiar funciones (llamado cuando BoardSwitchProvider se desmonta)
  unregisterNavigation: () => void;

  // Helper para saber si la navegación SPA está disponible
  isNavigationReady: () => boolean;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  switchBoard: null,
  switchBoardView: null,

  registerNavigation: (fns) =>
    set({
      switchBoard: fns.switchBoard,
      switchBoardView: fns.switchBoardView,
    }),

  unregisterNavigation: () =>
    set({
      switchBoard: null,
      switchBoardView: null,
    }),

  isNavigationReady: () => {
    const state = get();
    return state.switchBoard !== null;
  },
}));
