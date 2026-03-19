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
      (state) => state.unreads[conversation.id] || 0,
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

    if (lastMessage.hasAttachment || lastMessage.attachmentAsset) {
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
            "group flex items-center gap-x-2 w-full cursor-pointer transition mb-1 py-1 px-2 rounded-none relative",
            "border border-transparent hover:border-theme-border hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]",
            "hover:bg-theme-channel-hover",
            isActive &&
              "bg-theme-channel-active border-transparent border-l-4 [border-left-color:var(--theme-border-accent-active-channel)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]",
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
            className="h-8 w-8 md:h-8 md:w-8"
            ringColorClass="indicator-ring"
            overlayRingColorClass={cn(
              "bg-theme-bg-secondary group-hover:bg-theme-channel-hover",
              isActive && "!bg-theme-channel-active",
              (isPending || isHiding) && "opacity-50",
            )}
            animationMode="onHover"
            isHovered={isHovered}
          />

          <div className="flex flex-col items-start gap-y-0 flex-1">
            <p
              className={cn(
                "text-[14.5px] transition -mb-0.5",
                getUsernameFormatClasses(otherProfile.usernameFormat),
                getGradientAnimationClass(otherProfile.usernameColor),
                // Si no tiene color personalizado, usar estilos por defecto
                !otherProfile.usernameColor &&
                  "text-theme-text-tertiary group-hover:text-theme-text-secondary",
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

            <span className="text-[13px] text-theme-text-tertiary truncate w-[140px] text-left">
              {lastMessagePreview}
            </span>
          </div>

          {/* INDICADOR DE MENSAJES NO LEÍDOS - bolita naranja */}
          {hasUnread && !isActive && (
            <div className="w-2.5 h-2.5 bg-[#D6A86C] rounded-full shrink-0" />
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={handleDeleteConversation}
          disabled={isHiding}
          className="text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t.dm.deleteConversation}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
