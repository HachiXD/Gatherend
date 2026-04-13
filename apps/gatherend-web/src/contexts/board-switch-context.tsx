"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  useBoardNavigationStore,
  selectRouting,
  selectActions,
  selectIsInitialized,
  getLastBoardViewForBoard,
  getLastChatsViewForBoard,
  resolveLastBoardViewForBoard,
} from "@/stores/board-navigation-store";
// Re-export utility function for backward compatibility
export {
  getLastBoardViewForBoard,
  getLastChatsViewForBoard,
  resolveLastBoardViewForBoard,
};

/**
 *
 * BoardSwitchContext - Client-Side Navigation para Boards (Zustand Version)
 *
 *
 * ARQUITECTURA:
 * - Estado vive en Zustand store (singleton global)
 * - Provider solo inicializa el store desde la URL (una vez)
 * - Hooks usan selectores para re-renders granulares
 * - NO hay Context.Provider — children se renderizan directamente
 *
 * BENEFICIOS:
 * - Layout nunca re-renderiza por cambios de navegación
 * - Solo los componentes que usan selectores específicos re-renderizan
 * - Navegación back/forward funciona via listener pasivo en el store
 *
 *
 */

interface BoardSwitchProviderProps {
  children: React.ReactNode;
}

/**
 * Provider ligero que solo inicializa el store.
 * NO recibe props de navegación — el store parsea la URL directamente.
 * NO usa Context.Provider — renderiza children directamente.
 */
export function BoardSwitchProvider({ children }: BoardSwitchProviderProps) {
  const initializeFromUrl = useBoardNavigationStore(
    (state) => state.initializeFromUrl,
  );

  // Initialize store from URL once on mount
  useEffect(() => {
    initializeFromUrl();
  }, [initializeFromUrl]);

  // No Context.Provider needed — just render children
  return <>{children}</>;
}

// Hooks (backward compatible API)

/**
 * Hook para acceder al estado completo de navegación de boards.
 * Permite cambiar de board sin hacer SSR.
 *
 * NOTA: Este hook causa re-render en CUALQUIER cambio del store.
 * Preferible useBoardSwitchRouting() o useBoardSwitchNavigation() para
 * mejor performance.
 */
export function useBoardSwitch() {
  const routing = useBoardNavigationStore(useShallow(selectRouting));
  const actions = useBoardNavigationStore(useShallow(selectActions));
  const isInitialized = useBoardNavigationStore(selectIsInitialized);

  if (!isInitialized) {
    throw new Error(
      "useBoardSwitch must be used within BoardSwitchProvider (store not initialized)",
    );
  }

  return {
    ...routing,
    ...actions,
  };
}

/**
 * Hook opcional que no lanza error si el store no está inicializado.
 * Retorna null si no está listo.
 */
export function useBoardSwitchSafe() {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const routing = useBoardNavigationStore(useShallow(selectRouting));
  const actions = useBoardNavigationStore(useShallow(selectActions));

  if (!isInitialized) {
    return null;
  }

  return {
    ...routing,
    ...actions,
  };
}

/**
 * Hook que solo retorna los valores necesarios para routing.
 * OPTIMIZADO: Solo re-renderiza cuando cambian valores de navegación.
 */
export function useBoardSwitchRouting() {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const routing = useBoardNavigationStore(useShallow(selectRouting));

  if (!isInitialized) {
    throw new Error(
      "useBoardSwitchRouting must be used within BoardSwitchProvider",
    );
  }

  return routing;
}

/**
 * Hook que solo retorna las funciones de navegación.
 * OPTIMIZADO: Las funciones son estables, nunca cambian.
 * Solo re-renderiza una vez cuando isClientNavigationEnabled pasa a true.
 */
export function useBoardSwitchNavigation() {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const actions = useBoardNavigationStore(useShallow(selectActions));

  if (!isInitialized) {
    throw new Error(
      "useBoardSwitchNavigation must be used within BoardSwitchProvider",
    );
  }

  return actions;
}

// Individual selectors for maximum granularity

/**
 * Hook para obtener solo el boardId actual.
 * MÁXIMA GRANULARIDAD: Solo re-renderiza cuando cambia el boardId.
 */
export function useCurrentBoardId(): string {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const boardId = useBoardNavigationStore((state) => state.currentBoardId);

  if (!isInitialized) {
    throw new Error("useCurrentBoardId requires BoardSwitchProvider");
  }

  return boardId;
}

/**
 * Hook para obtener solo el channelId actual.
 */
export function useCurrentChannelId(): string | null {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const channelId = useBoardNavigationStore((state) => state.currentChannelId);

  if (!isInitialized) {
    throw new Error("useCurrentChannelId requires BoardSwitchProvider");
  }

  return channelId;
}

/**
 * Hook para obtener solo el conversationId actual.
 */
export function useCurrentConversationId(): string | null {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const conversationId = useBoardNavigationStore(
    (state) => state.currentConversationId,
  );

  if (!isInitialized) {
    throw new Error("useCurrentConversationId requires BoardSwitchProvider");
  }

  return conversationId;
}

/**
 * Hook para saber si estamos en discovery.
 */
export function useIsDiscovery(): boolean {
  const isInitialized = useBoardNavigationStore(selectIsInitialized);
  const isDiscovery = useBoardNavigationStore((state) => state.isDiscovery);

  if (!isInitialized) {
    throw new Error("useIsDiscovery requires BoardSwitchProvider");
  }

  return isDiscovery;
}
