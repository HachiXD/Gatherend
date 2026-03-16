"use client";

import { memo, Suspense, useMemo } from "react";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";
import { ChannelView } from "./views/channel-view";
import { ConversationView } from "./views/conversation-view";
import { BoardView } from "./views/board-view";
import { DiscoveryCommunityView } from "./views/discovery-community-view";
import { CommunityView } from "./views/community-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewLoadingFallback, ViewErrorFallback } from "./views/view-fallbacks";
// Instancia estable de loading fallback — evita recrear JSX en cada render
const LOADING_FALLBACK = <ViewLoadingFallback />;

// Render prop estable para error fallback
const ERROR_FALLBACK_RENDER = ({ reset }: { reset: () => void }) => (
  <ViewErrorFallback onRetry={reset} />
);

/**
 * CenterContentRouter - Enrutador de vistas del centro
 *
 * Este componente decide qué vista mostrar en el área central
 * basándose en el estado del BoardSwitchContext, NO en los params de la URL.
 *
 * OPTIMIZACIÓN: Usa useBoardSwitchRouting() en lugar de useBoardSwitch()
 * para evitar re-renders cuando cambian propiedades que no afectan el routing.
 *
 * Vistas posibles:
 * - CommunityView: cuando hay un currentCommunityId
 * - DiscoveryCommunityView: cuando isDiscovery es true (lista de comunidades)
 * - ConversationView: cuando hay un currentConversationId
 * - ChannelView: cuando hay un currentChannelId
 * - BoardView: fallback (redirige al primer canal)
 */
function CenterContentRouterInner() {
  // Hook selectivo - solo se suscribe a valores de routing
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    currentCommunityId,
    currentCommunitySection,
    isDiscovery,
  } = useBoardSwitchRouting();

  // Memoizar la vista para evitar recrear JSX innecesariamente
  const currentView = useMemo(() => {
    // Prioridad de renderizado:
    // 1. Discovery con communityId
    if (isDiscovery && currentCommunityId) {
      return (
        <CommunityView
          key={`community-${currentCommunityId}`}
          communityId={currentCommunityId}
        />
      );
    }

    // 2. Discovery sin communityId (lista de comunidades)
    if (isDiscovery) {
      return <DiscoveryCommunityView key={`discovery-${currentBoardId}`} />;
    }

    // 3. Conversación (si hay currentConversationId)
    if (currentConversationId) {
      return (
        <ConversationView
          key={`conversation-${currentConversationId}`}
          conversationId={currentConversationId}
          boardId={currentBoardId}
        />
      );
    }

    // 4. Canal (si hay currentChannelId)
    if (currentChannelId) {
      return (
        <ChannelView
          key={`channel-${currentChannelId}`}
          channelId={currentChannelId}
          boardId={currentBoardId}
        />
      );
    }

    // 5. BoardView (fallback - redirige al primer canal)
    return <BoardView key={`board-${currentBoardId}`} />;
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    currentCommunityId,
    isDiscovery,
  ]);

  const routeKey = useMemo(
    () => {
      if (isDiscovery && currentCommunityId) {
        return `${currentBoardId}:community:${currentCommunityId}`;
      }

      return `${currentBoardId}:${currentChannelId ?? "none"}:${
        currentConversationId ?? "none"
      }:${currentCommunityId ?? "none"}:${currentCommunitySection}:${
        isDiscovery ? "1" : "0"
      }`;
    },
    [
      currentBoardId,
      currentChannelId,
      currentConversationId,
      currentCommunityId,
      currentCommunitySection,
      isDiscovery,
    ],
  );

  return (
    <ErrorBoundary key={routeKey} fallback={ERROR_FALLBACK_RENDER}>
      <Suspense fallback={LOADING_FALLBACK}>{currentView}</Suspense>
    </ErrorBoundary>
  );
}

// Memoizar para evitar re-renders innecesarios del padre
export const CenterContentRouter = memo(CenterContentRouterInner);
