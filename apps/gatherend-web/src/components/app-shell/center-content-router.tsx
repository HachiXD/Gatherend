"use client";

import { memo, Suspense, useMemo } from "react";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";
import { ChannelView } from "./views/channel-view";
import { ConversationView } from "./views/conversation-view";
import { BoardView } from "./views/board-view";
import { DiscoveryCommunityView } from "./views/discovery-community-view";
import { RulesView } from "./views/rules-view";
import { RankingView } from "./views/ranking-view";
import { ChannelsView } from "./views/channels-view";
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
 * - DiscoveryCommunityView: cuando isDiscovery es true (lista de boards públicos)
 * - ConversationView: cuando hay un currentConversationId
 * - ChannelView: cuando hay un currentChannelId (incluye FORUM y WIKI via channel type)
 * - BoardView: fallback
 */
function CenterContentRouterInner() {
  // Hook selectivo - solo se suscribe a valores de routing
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isRules,
    isRanking,
  } = useBoardSwitchRouting();

  // Memoizar la vista para evitar recrear JSX innecesariamente
  const currentView = useMemo(() => {
    // Prioridad de renderizado:
    // 1. Discovery (lista de boards públicos)
    if (isDiscovery) {
      return <DiscoveryCommunityView key={`discovery-${currentBoardId}`} />;
    }

    // 2. Conversación (si hay currentConversationId)
    if (currentConversationId) {
      return (
        <ConversationView
          key={`conversation-${currentConversationId}`}
          conversationId={currentConversationId}
          boardId={currentBoardId}
        />
      );
    }

    // 3. Canal (si hay currentChannelId)
    if (currentChannelId) {
      return (
        <ChannelView
          key={`channel-${currentChannelId}`}
          channelId={currentChannelId}
          boardId={currentBoardId}
        />
      );
    }

    // 4. Channels del board
    if (isChannels) {
      return <ChannelsView key={`channels-${currentBoardId}`} />;
    }

    // 5. Reglas del board
    if (isRules) {
      return <RulesView key={`rules-${currentBoardId}`} />;
    }

    // 6. Ranking del board
    if (isRanking) {
      return <RankingView key={`ranking-${currentBoardId}`} />;
    }

    // 7. BoardView (fallback)
    return <BoardView key={`board-${currentBoardId}`} />;
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isRules,
    isRanking,
  ]);

  const routeKey = useMemo(
    () => {
      return `${currentBoardId}:${currentChannelId ?? "none"}:${
        currentConversationId ?? "none"
      }:${isDiscovery ? "discovery" : isChannels ? "channels" : isRules ? "rules" : isRanking ? "ranking" : "other"}`;
    },
    [
      currentBoardId,
      currentChannelId,
      currentConversationId,
      isDiscovery,
      isChannels,
      isRules,
      isRanking,
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
