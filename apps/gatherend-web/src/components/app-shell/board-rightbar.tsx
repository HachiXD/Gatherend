"use client";

import { useMemo, memo } from "react";
import { RightbarSkeleton as _RightbarSkeleton } from "@/components/board/board-skeletons";
import { Separator } from "@/components/ui/separator";
import { DirectMessages } from "@/components/board/rightbar/rightbar-direct-messages-list";
import { VoiceControlBar } from "@/components/voice-control-bar";
import {
  useConversations,
  useConversationProfileIds,
} from "@/hooks/use-conversations";
import { usePresence } from "@/hooks/use-presence";
import { useBoardDataWithStaleness } from "@/hooks/use-board-data-with-staleness";
import {
  useBoardMemberIds,
  useCurrentMemberRole,
} from "@/hooks/use-board-data";
import { useProfileRoomSubscriptions } from "@/hooks/use-profile-room-subscriptions";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useTranslation } from "@/i18n";
import { cn as _cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeftbarClient } from "@/components/board/leftbar/board-leftbar-client";
import { useBoardAccent } from "@/hooks/use-board-accent";

/**
 *
 * BoardRightbarClient - Arquitectura optimizada con secciones independientes
 *
 *
 * PROBLEMA ANTERIOR:
 * Un solo componente con todos los hooks causaba 9+ re-renders al cambiar board
 * porque TODOS los hooks disparaban cuando cualquier dato cambiaba.
 *
 * SOLUCIÓN:
 * Separar en secciones independientes que solo reaccionan a sus propios datos:
 * - MembersSectionClient: reacciona a cambios del board
 * - DirectMessagesSectionClient: independiente del board (memoizado)
 * - PresenceManager: invisible, maneja presencia de forma centralizada
 *
 *
 */

/**
 * Wrapper principal del rightbar - estructura mínima con secciones independientes.
 */
function BoardRightbarClientInner() {
  const profile = useProfile();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Presencia centralizada - invisible, no causa re-renders visuales */}
      <PresenceManager profileId={profile.id} />

      {/* Channels Section - canales del board activo */}
      <ChannelsSectionClient />

      <Separator className="bg-theme-border-primary rounded-md mt-0 mb-2" />

      {/* Direct Messages - independiente del board, memoizado */}
      <div className="h-[49%] shrink-0 flex flex-col min-h-0">
        <DirectMessagesSectionClient profileId={profile.id} />
      </div>

      {/* Voice Control Bar - aparece al final cuando hay llamada activa */}
      <VoiceControlBar position="right" />
    </div>
  );
}

/**
 * Componente invisible que maneja presencia para todos los usuarios relevantes.
 * Separado para que sus re-renders no afecten el rendering visual.
 */
const PresenceManager = memo(function PresenceManager({
  profileId,
}: {
  profileId: string;
}) {
  const memberIds = useBoardMemberIds();
  const conversationProfileIds = useConversationProfileIds();

  const allProfileIds = useMemo(() => {
    return [...new Set([profileId, ...memberIds, ...conversationProfileIds])];
  }, [profileId, memberIds, conversationProfileIds]);

  usePresence(allProfileIds);

  return null; // Invisible
});

/**
 * ChannelsSectionClient - Canales del board activo.
 * Se re-renderiza cuando cambia el board.
 */
const ChannelsSectionClient = memo(function ChannelsSectionClient() {
  const { t } = useTranslation();
  const { board, showSkeleton } = useBoardDataWithStaleness();
  const profile = useProfile();
  const role = useCurrentMemberRole(profile.id);
  const accentVars = useBoardAccent(board?.imageAsset?.url);

  if (showSkeleton || !board) {
    return <ChannelsSkeleton />;
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={accentVars ? { ...accentVars, backgroundColor: accentVars["--leftbar-bg"] } as React.CSSProperties : undefined}
    >
      <div className="px-3 pt-2 pb-1 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
          {t.board.channels}
        </h2>
      </div>
      <ScrollArea className="flex-1 min-h-0 px-1">
        <div className="px-1 pb-2">
          <LeftbarClient boardId={board.id} role={role} />
        </div>
      </ScrollArea>
    </div>
  );
});

function ChannelsSkeleton() {
  return (
    <div className="px-4 pt-3 flex-1">
      <div className="h-3 w-16 bg-theme-bg-tertiary rounded animate-pulse mb-3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5">
          <div className="h-4 w-4 rounded bg-theme-bg-tertiary animate-pulse shrink-0" />
          <div className="h-3 flex-1 rounded bg-theme-bg-tertiary animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Sección de DMs - NO SE RE-RENDERIZA cuando cambia el board.
 * Las conversaciones son independientes del board actual.
 */
const DirectMessagesSectionClient = memo(function DirectMessagesSectionClient({
  profileId,
}: {
  profileId: string;
}) {
  const { conversations, isLoading } = useConversations();

  const topDmProfileIds = useMemo(() => {
    const list = conversations || [];
    return list
      .slice(0, 20)
      .map((c) => c.otherProfile?.id)
      .filter((id): id is string => !!id);
  }, [conversations]);

  useProfileRoomSubscriptions(topDmProfileIds);

  if (isLoading) {
    return <DirectMessagesSkeleton />;
  }

  return (
    <DirectMessages
      conversations={conversations || []}
      currentProfileId={profileId}
    />
  );
});

function DirectMessagesSkeleton() {
  return (
    <div className="px-4 pt-2">
      <div className="h-4 w-32 bg-theme-bg-tertiary rounded animate-pulse mb-3" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2">
          <div className="w-8 h-8 rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div className="h-4 w-24 bg-theme-bg-tertiary rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Memoizar el wrapper principal
export const BoardRightbarClient = memo(BoardRightbarClientInner);
