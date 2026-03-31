"use client";

import { VoiceLiveKitProvider } from "@/components/providers/voice-livekit-provider";
import { memo, ReactNode, useMemo } from "react";
import {
  MobileHeader,
  MobileLeftDrawerContent,
  MobileRightDrawerContent,
} from "@/components/mobile";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  leftbar: ReactNode;
  rightbar: ReactNode;
  header: ReactNode;
  navigationSidebar: ReactNode;
}

/**
 * AppShell - Estructura visual principal de la aplicación
 * Contenedor que se renderiza instantáneamente con slots para cada sección
 */
export const AppShell = memo(function AppShell({
  children,
  leftbar,
  rightbar,
  header,
  navigationSidebar,
}: AppShellProps) {
  // Stable elements so MobileHeader memo can bail out when AppShell re-renders.
  const mobileLeftDrawerContent = useMemo(
    () => (
      <MobileLeftDrawerContent
        navigationSidebar={navigationSidebar}
        leftbar={leftbar}
      />
    ),
    [navigationSidebar, leftbar],
  );
  const mobileRightDrawerContent = useMemo(
    () => <MobileRightDrawerContent rightbar={rightbar} />,
    [rightbar],
  );

  return (
    <VoiceLiveKitProvider>
      <div className="h-screen h-[100dvh]">
        {/* Mobile Header - Solo visible en móvil */}
        <MobileHeader
          leftDrawerContent={mobileLeftDrawerContent}
          rightDrawerContent={mobileRightDrawerContent}
        />

        {/* Navigation Sidebar (top) - Solo desktop */}
        <div className="hidden md:flex fixed border-r border-theme-border-secondary top-0 left-0 w-[312px] h-[calc(100vh-386px)] z-30 flex-col bg-theme-bg-primary">
          {navigationSidebar}
        </div>

        {/* Board Leftbar (bottom) - Solo desktop */}
        <div className="hidden md:flex fixed border-r border-theme-border-secondary left-0 bottom-0 w-[312px] h-[386px] z-20 flex-col bg-theme-bg-secondary">
          {leftbar}
        </div>

        {/* Main header - Solo desktop */}
        <div
          className="hidden md:flex fixed items-center top-0 left-[312px] right-0 h-12 
          bg-theme-bg-quinary
          border-b border-theme-border-secondary z-30"
        >
          {header}
        </div>

        {/* Content - Con padding-top en móvil para el header fijo */}
        {/* El gradiente se aplica aquí cuando está habilitado, sino usa bgTertiary */}
        <main
          className={cn(
            "app-shell-main h-full pt-14 md:pt-12 md:pl-[312px] md:pr-64 bg-theme-bg-tertiary flex flex-col overflow-hidden",
          )}
        >
          <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        </main>

        {/* Rightbar - Solo desktop */}
        <div className="hidden md:flex fixed right-0 top-12 w-64 h-[calc(100vh-48px)] z-20 flex-col bg-theme-bg-secondary border-l border-theme-border-secondary">
          {rightbar}
        </div>
      </div>
    </VoiceLiveKitProvider>
  );
});
