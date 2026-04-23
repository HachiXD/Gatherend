"use client";

import { Globe } from "lucide-react";
import { memo, useCallback, useTransition } from "react";
import { useBoardSwitchNavigation } from "@/contexts/board-switch-context";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { ActionTooltip } from "@/components/action-tooltip";
import { useTranslation } from "@/i18n";

/**
 * BoardDiscovery es el botón para navegar al discovery del board.
 */
export const BoardDiscovery = memo(function BoardDiscovery() {
  const { switchToDiscovery, isClientNavigationEnabled } =
    useBoardSwitchNavigation();
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    startTransition(() => {
      if (isClientNavigationEnabled) {
        switchToDiscovery();
      } else {
        const boardId = useBoardNavigationStore.getState().currentBoardId;
        window.location.href = `/boards/${boardId}/discovery`;
      }
    });
  }, [isClientNavigationEnabled, switchToDiscovery]);

  return (
    <ActionTooltip
      side="right"
      align="center"
      label={t.discovery.meetNewFriends}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex h-12 w-12  rounded-2xl cursor-pointer items-center justify-center  bg-theme-tab-button-bg px-1 py-0.5 text-theme-text-light transition hover:bg-theme-tab-button-hover hover:text-theme-text-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Globe className="h-6 w-6" />
      </button>
    </ActionTooltip>
  );
});
