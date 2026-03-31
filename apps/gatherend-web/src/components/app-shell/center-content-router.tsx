"use client";

import { memo, Suspense, useMemo } from "react";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";
import { ChannelView } from "./views/channel-view";
import { ConversationView } from "./views/conversation-view";
import { BoardView } from "./views/board-view";
import { DiscoveryCommunityView } from "./views/discovery-community-view";
import { ForumView } from "./views/forum-view";
import { RulesView } from "./views/rules-view";
import { MembersView } from "./views/members-view";
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
    isForum,
    isRules,
    isMembers,
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

    // 4. Reglas del board
    if (isRules) {
      return <RulesView key={`rules-${currentBoardId}`} />;
    }

    // 5. Miembros del board
    if (isMembers) {
      return <MembersView key={`members-${currentBoardId}`} />;
    }

    // 6. Foro del board
    if (isForum) {
      return <ForumView key={`forum-${currentBoardId}`} />;
    }

    // 6. BoardView (fallback - redirige al foro)
    return <BoardView key={`board-${currentBoardId}`} />;
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    isDiscovery,
    isForum,
    isRules,
    isMembers,
  ]);

  const routeKey = useMemo(
    () => {
      return `${currentBoardId}:${currentChannelId ?? "none"}:${
        currentConversationId ?? "none"
      }:${isDiscovery ? "discovery" : isRules ? "rules" : isMembers ? "members" : isForum ? "forum" : "other"}`;
    },
    [
      currentBoardId,
      currentChannelId,
      currentConversationId,
      isDiscovery,
      isForum,
      isRules,
      isMembers,
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
