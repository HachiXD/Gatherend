"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DirectMessageItem } from "./rightbar-direct-messages-item";
import { UserPlus } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import type { FormattedConversation } from "@/hooks/use-conversations";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface DirectMessagesListProps {
  conversations: FormattedConversation[];
  currentProfileId: string;
}

export const DirectMessages = ({
  conversations: initialConversations,
  currentProfileId,
}: DirectMessagesListProps) => {
  // Solo suscribirse a la acción para evitar re-renders cuando cambia el estado global del modal.
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const { t } = useTranslation();
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);
  const isHoveringRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) setIsScrollbarVisible(false);
    }, 1500);
  }, [clearHideTimeout]);

  const showScrollbar = useCallback(() => {
    setIsScrollbarVisible(true);
  }, []);

  const handleItemHoverChange = useCallback(
    (isHovered: boolean) => {
      isHoveringRef.current = isHovered;
      if (isHovered) {
        showScrollbar();
        clearHideTimeout();
      } else {
        scheduleHide();
      }
    },
    [clearHideTimeout, scheduleHide, showScrollbar],
  );

  const handleScroll = useCallback(() => {
    showScrollbar();
    scheduleHide();
  }, [scheduleHide, showScrollbar]);

  useEffect(() => {
    return () => clearHideTimeout();
  }, [clearHideTimeout]);

  // NOTE: Este componente es presentacional. La fuente de datos (TanStack Query)
  // vive en DirectMessagesSectionClient para evitar observers duplicados que
  // causan renders extra durante la navegación.
  const conversations = initialConversations;

  return (
    <div
      onScroll={handleScroll}
      className={cn(
        "flex flex-col flex-1 min-h-0 overflow-y-auto pr-3 -mt-1.5 space-y-2",
        isScrollbarVisible ? "scrollbar-navigation" : "scrollbar-hidden",
      )}
    >
      <div className="flex items-center justify-between pl-3 pr-1">
        <div className="text-[14px]  uppercase text-theme-text-tertiary">
          {t.dm.social}
        </div>
        <button
          onClick={() => onOpen("addFriend")}
          className="
            py-1.5 pr-0 pl-1.5
            text-theme-add-friend-icon
            hover:text-theme-add-friend-hover
            rounded-full
            transition
            cursor-pointer
          "
          title={t.dm.addFriend}
        >
          <UserPlus className="w-5.5 h-5.5" />
        </button>
      </div>

      {conversations.length > 0 ? (
        <div className="flex flex-col pl-1 space-y-0 -mt-3">
          {conversations.map((conv) => (
            <DirectMessageItem
              key={conv.id}
              conversation={conv}
              currentProfileId={currentProfileId}
              onHoverChange={handleItemHoverChange}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-theme-text-muted-alt pl-3 py-2">
          {t.dm.noActiveConversations}
        </p>
      )}
    </div>
  );
};
