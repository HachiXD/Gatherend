"use client";

import { memo, ReactNode } from "react";
import { Menu, ArrowLeft, ChevronLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { useMobileTitle } from "@/hooks/use-mobile-title";
import { useMobileDrawerStore } from "@/stores/mobile-drawer-store";

interface MobileHeaderProps {
  leftDrawerContent: ReactNode;
  rightDrawerContent: ReactNode;
}

/**
 * MobileHeader - Header para dispositivos móviles con drawers laterales.
 *
 * OPTIMIZACIÓN: Usa useBoardSwitchSafe() en lugar de usePathname() para
 * obtener isDiscovery del contexto SPA. Esto evita suscribirse al Router
 * de Next.js y previene re-renders en cada navegación.
 *
 * Memoizado para evitar re-renders cuando las props no cambian.
 */
export const MobileHeader = memo(function MobileHeader({
  leftDrawerContent,
  rightDrawerContent,
}: MobileHeaderProps) {
  const { leftOpen, rightOpen, setLeftOpen, setRightOpen } =
    useMobileDrawerStore();
  const boardSwitch = useBoardSwitchSafe();
  const title = useMobileTitle();

  // Usar contexto SPA — no se suscribe a usePathname()
  const isDiscovery = boardSwitch?.isDiscovery ?? false;
  const isChannelChat = Boolean(boardSwitch?.currentChannelId);

  const handleChatBackClick = () => {
    if (!boardSwitch) return;
    boardSwitch.switchToChannelList(boardSwitch.currentBoardId);
  };

  return (
    <>
      {/* Mobile Header - Solo visible en móvil */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-theme-bg-tertiary border-b border-theme-border-secondary z-50 flex items-center px-3">
        {/* Left side - Menu button + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftOpen(true)}
            className="text-theme-text-primary hover:bg-theme-border-secondary flex-shrink-0"
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Title (solo cuando no estás en discovery y hay título) */}
          {isChannelChat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleChatBackClick}
              className="text-theme-text-primary hover:bg-theme-border-secondary flex-shrink-0"
              aria-label="Volver a la lista de chats"
              title="Volver a la lista de chats"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}

          {!isDiscovery && title && (
            <h1 className="text-theme-text-primary font-semibold text-base truncate">
              {title}
            </h1>
          )}
        </div>

        {/* Right side - Right drawer button */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightOpen(true)}
            className="text-theme-text-primary hover:bg-theme-border-secondary"
            title="Members & DMs"
          >
            <Users className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {/* Left Drawer */}
      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent
          side="left"
          hideCloseButton
          className="p-0 w-[92vw] max-w-[420px] bg-theme-bg-primary border-r border-theme-border-secondary"
        >
          <VisuallyHidden>
            <SheetTitle>Navigation Menu</SheetTitle>
          </VisuallyHidden>
          {/* Drawer Header con botón Back */}
          <div className="h-8 flex items-center px-3 border-b border-theme-border-secondary">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftOpen(false)}
              className="text-theme-text-primary hover:bg-theme-border-secondary gap-1"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </Button>
          </div>
          {/* Drawer Content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {leftDrawerContent}
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Drawer */}
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent
          side="right"
          hideCloseButton
          className="p-0 w-[85vw] max-w-[320px] bg-theme-bg-secondary border-l border-theme-border-secondary"
        >
          <VisuallyHidden>
            <SheetTitle>Members and Direct Messages</SheetTitle>
          </VisuallyHidden>
          {/* Drawer Header con botón Back */}
          <div className="h-8 flex items-center px-3 border-b border-theme-border-secondary">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightOpen(false)}
              className="text-theme-text-primary hover:bg-theme-border-secondary gap-1"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </Button>
          </div>
          {/* Drawer Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightDrawerContent}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});
