"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import {
  BoardSwitchProvider,
  useCurrentBoardId,
} from "@/contexts/board-switch-context";
import { NavigationSidebarClient } from "@/components/app-shell/navigation-sidebar";
import { BoardLeftbarClient } from "@/components/app-shell/board-leftbar";
import { BoardRightbarClient } from "@/components/app-shell/board-rightbar";
import { BoardHeaderClient } from "@/components/app-shell/board-header";
import { GlobalUnreadProvider } from "@/components/app-shell/providers/global-unread-provider-client";
import { ChatCacheProvider } from "@/components/app-shell/providers/chat-cache-provider";
import {
  ProfileProvider,
  useProfile,
} from "@/components/app-shell/providers/profile-provider";
import { UserThemeApplier } from "@/components/app-shell/providers/user-theme-applier";
import { useUserBoards } from "@/hooks/use-user-boards";
import { CenterContentRouter } from "@/components/app-shell/center-content-router";

import { useBoardSlotProfileIds } from "@/hooks/use-board-data";
import { useBoardKickedSocket } from "@/hooks/use-board-kicked-socket";
import { useProfileRoomSubscriptions } from "@/hooks/use-profile-room-subscriptions";

// BoardId Layout - Client Component (SPA)

//
// Este layout es 100% cliente. La auth ya fue validada
// en el layout de (main) (server).
//
// ARQUITECTURA ZUSTAND:
// - BoardSwitchProvider solo inicializa el store (no recibe props)
// - El store parsea la URL directamente
// - El layout NO re-renderiza cuando cambia la navegación
// - Solo los componentes que usan selectores específicos re-renderizan
//

function BoardIdLayoutContent() {
  const profile = useProfile();
  const { data: boards } = useUserBoards();

  const boardIds = boards?.map((b) => b.id) || [];

  return (
    <GlobalUnreadProvider currentProfileId={profile.id} boardIds={boardIds}>
      <ChatCacheProvider currentProfileId={profile.id}>
        {/* BoardSwitchProvider ya no recibe props — parsea la URL directamente */}
        <BoardSwitchProvider>
          <BoardLayoutInner />
        </BoardSwitchProvider>
      </ChatCacheProvider>
    </GlobalUnreadProvider>
  );
}

/**
 * Componente interno que usa el store Zustand para obtener currentBoardId.
 *
 * OPTIMIZADO: Usa useBoardSwitchRouting() con selector de Zustand.
 * Solo re-renderiza cuando cambian valores de navegación específicos.
 */
function BoardLayoutInner() {
  // Solo depende del boardId; evita re-renders al navegar entre channel/conversation/discovery.
  const currentBoardId = useCurrentBoardId();
  useBoardKickedSocket();

  // Realtime profile updates for member grid (occupied slots; N<=49)
  const slotProfileIds = useBoardSlotProfileIds();
  useProfileRoomSubscriptions(slotProfileIds);

  // Instancias estables — no se recrean cuando currentBoardId cambia
  const navigationSidebar = useMemo(() => <NavigationSidebarClient />, []);
  const centerContent = useMemo(() => <CenterContentRouter />, []);
  const rightbar = useMemo(() => <BoardRightbarClient />, []);
  const header = useMemo(() => <BoardHeaderClient />, []);

  // OPTIMIZADO:
  // - leftbar: key para resetear scroll y estado cuando cambia el board
  // - rightbar: memoizado, MembersSection reacciona al store internamente
  // - header: memoizado, es completamente estático
  return (
    <AppShell
      navigationSidebar={navigationSidebar}
      leftbar={<BoardLeftbarClient key={`leftbar-${currentBoardId}`} />}
      rightbar={rightbar}
      header={header}
    >
      {centerContent}
    </AppShell>
  );
}

export default function BoardIdLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  // Nota: Los children de Next.js no se usan porque CenterContentRouter
  // decide qué vista mostrar basándose en el estado del store Zustand.
  return (
    <ProfileProvider>
      <UserThemeApplier />
      <BoardIdLayoutContent />
    </ProfileProvider>
  );
}
