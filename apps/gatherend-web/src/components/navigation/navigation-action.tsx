"use client";

import { memo, useCallback } from "react";
import { Plus } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "@/i18n";

/**
 * NavigationAction - Botón para crear/unirse a un board
 *
 * OPTIMIZACIÓN: Memoizado + selector de Zustand para evitar re-renders
 * innecesarios cuando cambia el estado global del modal o la navegación.
 */
export const NavigationAction = memo(function NavigationAction() {
  // Selector de Zustand — solo se suscribe a onOpen, no al estado completo
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const { t } = useTranslation();

  // Callback estable — evita recrear la función en cada render
  const handleClick = useCallback(() => {
    onOpen("createBoard");
  }, [onOpen]);

  return (
    <ActionTooltip side="right" align="center" label={t.navigation.createBoard}>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-12 w-12 rounded-2xl cursor-pointer items-center justify-center  bg-theme-tab-button-bg px-1 py-0.5 text-theme-text-light transition hover:bg-theme-tab-button-hover hover:text-theme-text-light"
      >
        <Plus className="h-6 w-6" />
      </button>
    </ActionTooltip>
  );
});
