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

  const isConversation = type === "conversation";

  const buttonEl = (
    <button
      type="button"
      onMouseEnter={enableTooltipsOnce}
      onClick={handleOpenPinnedMessages}
      className={`flex ${isConversation ? "h-8 w-8 bg-theme-bg-secondary/40" : "h-7 w-7"} cursor-pointer items-center justify-center border border-theme-border text-theme-text-tertiary transition hover:text-theme-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]`}
      style={isConversation ? undefined : { backgroundColor: "var(--community-header-btn-bg)" }}
    >
      <Pin className={isConversation ? "h-5 w-5" : "h-4.5 w-4.5"} />
    </button>
  );

  if (!tooltipsEnabled) return buttonEl;

  return (
    <ActionTooltip side="bottom" label={t.chat.pinnedMessages}>
      {buttonEl}
    </ActionTooltip>
  );
};
