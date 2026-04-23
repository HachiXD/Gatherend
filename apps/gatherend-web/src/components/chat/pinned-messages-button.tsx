"use client";

import { Pin } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { ActionTooltip } from "@/components/action-tooltip";
import { useTranslation } from "@/i18n";
import { useCallback, useMemo, useState } from "react";

interface PinnedMessagesButtonProps {
  channelId?: string;
  conversationId?: string;
  type: "channel" | "conversation";
}

export const PinnedMessagesButton = ({
  channelId,
  conversationId,
  type,
}: PinnedMessagesButtonProps) => {
  // Solo suscribirse a la acción para evitar re-renders cuando cambia el estado global del modal.
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const { t } = useTranslation();

  // Lazy-mount Tooltip/Popper only after first hover on hover-capable devices.
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);
  const canHover = useMemo(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    return mq?.matches ?? false;
  }, []);
  const enableTooltipsOnce = useCallback(() => {
    if (!canHover) return;
    setTooltipsEnabled(true);
  }, [canHover]);

  const handleOpenPinnedMessages = () => {
    onOpen("pinnedMessages", {
      channelId,
      conversationId,
      roomType: type,
    });
  };

  const buttonEl = (
    <button
      type="button"
      onMouseEnter={enableTooltipsOnce}
      onClick={handleOpenPinnedMessages}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--community-header-btn-muted)] transition hover:bg-theme-app-settings-hover hover:text-[var(--community-header-btn-text)]"
    >
      <Pin className="h-6 w-6" />
    </button>
  );

  if (!tooltipsEnabled) return buttonEl;

  return (
    <ActionTooltip side="bottom" label={t.chat.pinnedMessages}>
      {buttonEl}
    </ActionTooltip>
  );
};
