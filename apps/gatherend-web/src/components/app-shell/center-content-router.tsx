"use client";

import { memo, Suspense, useMemo } from "react";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";
import { ChannelView } from "./views/channel-view";
import { ConversationView } from "./views/conversation-view";
import { BoardView } from "./views/board-view";
import { DiscoveryCommunityView } from "./views/discovery-community-view";
import { ForumView } from "./views/forum-view";
import { RulesView } from "./views/rules-view";
import { WikiView } from "./views/wiki-view";
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
 * - ChannelView: cuando hay un currentChannelId
 * - ForumView: cuando isForum es true
 * - BoardView: fallback (redirige al foro)
 */
function CenterContentRouterInner() {
  // Hook selectivo - solo se suscribe a valores de routing
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isForum,
    isRules,
    isWiki,
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

    // 6. Wiki del board
    if (isWiki) {
      return <WikiView key={`wiki-${currentBoardId}`} />;
    }

    // 7. Ranking del board
    if (isRanking) {
      return <RankingView key={`ranking-${currentBoardId}`} />;
    }

    // 8. Foro del board
    if (isForum) {
      return <ForumView key={`forum-${currentBoardId}`} />;
    }

    // 9. BoardView (fallback - redirige al foro)
    return <BoardView key={`board-${currentBoardId}`} />;
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isChannels,
    isForum,
    isRules,
    isWiki,
    isRanking,
  ]);

  const routeKey = useMemo(
    () => {
      return `${currentBoardId}:${currentChannelId ?? "none"}:${
        currentConversationId ?? "none"
      }:${isDiscovery ? "discovery" : isChannels ? "channels" : isRules ? "rules" : isWiki ? "wiki" : isRanking ? "ranking" : isForum ? "forum" : "other"}`;
    },
    [
      currentBoardId,
      currentChannelId,
      currentConversationId,
      isDiscovery,
      isChannels,
      isForum,
      isRules,
      isWiki,
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
