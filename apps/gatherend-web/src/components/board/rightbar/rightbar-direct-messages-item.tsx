"use client";

import { UserAvatar } from "../../user-avatar";
import { cn } from "@/lib/utils";
import { memo, useTransition, useCallback, useMemo, useState } from "react";
import { useUnreadStore } from "@/hooks/use-unread-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2 } from "lucide-react";
import {
  useConversations,
  FormattedConversation,
} from "@/hooks/use-conversations";
import {
  useBoardSwitchNavigation,
  useCurrentConversationId,
} from "@/contexts/board-switch-context";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useTranslation } from "@/i18n";
import { useTheme } from "next-themes";
import {
  getUsernameColorStyle,
  getGradientAnimationClass,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";

interface DirectMessageItemProps {
  conversation: FormattedConversation;
  currentProfileId: string;
  onHoverChange?: (isHovered: boolean) => void;
}

export const DirectMessageItem = memo(function DirectMessageItemComponent({
  conversation,
  currentProfileId: _currentProfileId,
  onHoverChange,
}: DirectMessageItemProps) {
  // OPTIMIZADO: Solo usa hooks granulares para evitar re-renders innecesarios
  // - useBoardSwitchNavigation: retorna funciones estables (nunca re-renderiza)
  // - useCurrentConversationId: solo re-renderiza cuando cambia la conversación activa
  // - NO usa useParams ni useBoardSwitchSafe (causaban re-renders al cambiar board)
  const { switchConversation, isClientNavigationEnabled } =
    useBoardSwitchNavigation();
  const currentConversationId = useCurrentConversationId();

  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  // Zustand con selector - solo re-render cuando cambia ESTA conversación
  const unreadCount = useUnreadStore(
    useCallback(
      (state) => state.dmUnreads[conversation.id] || 0,
      [conversation.id],
    ),
  );

  // TanStack Query para ocultar conversaciones (sin router.refresh)
  const { hideConversation, isHiding } = useConversations();

  const { otherProfile, lastMessage } = conversation;
  const hasUnread = unreadCount > 0;

  // Memoizar preview del último mensaje
  const lastMessagePreview = useMemo(() => {
    if (!lastMessage) return t.dm.noMessagesYet;

    if (lastMessage.deleted) return t.dm.messageDeleted;

    // Determinar si el mensaje es de la otra persona
    const isFromOtherPerson = lastMessage.senderId === otherProfile.id;

    let preview = "";

    if (lastMessage.stickerName) {
      preview = `[Sticker: ${lastMessage.stickerName}]`;
    } else if (lastMessage.hasAttachment || lastMessage.attachmentAsset) {
      preview = `📎 ${t.dm.sentAFile}`;
    } else {
      // Truncar contenido si es muy largo
      const maxLength = 25;
      if (lastMessage.content.length > maxLength) {
        preview = lastMessage.content.substring(0, maxLength) + "...";
      } else {
        preview = lastMessage.content;
      }
    }

    // Si el mensaje es de la otra persona, agregar su nombre
    if (isFromOtherPerson) {
      return `${otherProfile.username}: ${preview}`;
    }

    return preview;
  }, [
    lastMessage,
    otherProfile.id,
    otherProfile.username,
    t.dm.noMessagesYet,
    t.dm.messageDeleted,
    t.dm.sentAFile,
  ]);

  const onClick = () => {
    startTransition(() => {
      if (isClientNavigationEnabled) {
        // Navegación SPA - solo necesita la función, el store maneja la URL
        switchConversation(conversation.id);
      } else {
        // Fallback: leer boardId del store SIN suscribirse (getState no causa re-render)
        const boardId = useBoardNavigationStore.getState().currentBoardId;
        if (boardId) {
          window.location.href = `/boards/${boardId}/conversations/${conversation.id}`;
        } else {
          window.location.href = `/conversations/${conversation.id}`;
        }
      }
    });
  };

  const handleDeleteConversation = async () => {
    // Usar TanStack Query mutation (actualización optimista sin router.refresh)
    hideConversation(conversation.id);
  };

  // OPTIMIZADO: Solo depende de currentConversationId (hook granular)
  // No re-renderiza cuando cambia boardId o channelId
  const isActive = currentConversationId === conversation.id;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          disabled={isPending || isHiding}
          className={cn(
            "group flex items-center gap-x-2 w-full cursor-pointer transition mb-1 ml-1 py-1.5 px-2 rounded-sm relative",
            "border border-transparent",
            !isActive &&
              "hover:border-theme-border hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]",
            !isActive && "hover:bg-theme-channel-hover",
            isActive &&
              "bg-theme-channel-active border-transparent border-l-4 [border-left-color:var(--theme-border-accent-active-channel)] shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]",
            (isPending || isHiding) && "opacity-50",
          )}
          onMouseEnter={() => {
            setIsHovered(true);
            onHoverChange?.(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            onHoverChange?.(false);
          }}
        >
          <UserAvatar
            src={otherProfile.avatarAsset?.url || undefined}
            profileId={otherProfile.id}
            usernameColor={otherProfile.usernameColor}
            className="h-9 w-9 "
            ringColorClass="indicator-ring"
            overlayRingColorClass={cn(
              "bg-theme-bg-secondary",
              !isActive && "group-hover:bg-theme-channel-hover",
              isActive && "!bg-theme-channel-active",
              (isPending || isHiding) && "opacity-50",
            )}
            animationMode="onHover"
            isHovered={isHovered}
          />

          <div className="flex flex-col items-start gap-y-0 flex-1">
            <p
              className={cn(
                "text-[16px] transition -mb-0.5",
                getUsernameFormatClasses(otherProfile.usernameFormat),
                getGradientAnimationClass(otherProfile.usernameColor),
                // Si no tiene color personalizado, usar estilos por defecto
                !otherProfile.usernameColor &&
                  cn(
                    "text-theme-text-tertiary",
                    !isActive && "group-hover:text-theme-text-secondary",
                  ),
                isActive &&
                  !otherProfile.usernameColor &&
                  "text-theme-text-primary",
              )}
              style={getUsernameColorStyle(otherProfile.usernameColor, {
                isOwnProfile: false, // Siempre es otro usuario en DMs
                themeMode: (resolvedTheme as "dark" | "light") || "dark",
              })}
            >
              {otherProfile.username}
            </p>

            <span className="text-[15px] text-theme-text-tertiary truncate w-[140px] text-left">
              {lastMessagePreview}
            </span>
          </div>

          {/* CONTADOR DE MENSAJES NO LEÍDOS */}
          {hasUnread && !isActive && (
            <div className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-theme-unread-bg px-1">
              <span className="text-[11px] font-bold text-white leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            </div>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 rounded-none border border-theme-dropdown-border bg-theme-dropdown-bg p-1 shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1),inset_1px_0_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
        <ContextMenuItem
          onClick={handleDeleteConversation}
          disabled={isHiding}
          className="h-11 cursor-pointer rounded-none border border-rose-500/20 bg-rose-500/6 px-3 py-2 text-sm text-rose-400 focus:border-rose-500/35 focus:bg-rose-500/10 focus:text-rose-400 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t.dm.deleteConversation}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
