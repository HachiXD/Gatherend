"use client";

import { memo, useTransition, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChannelType, MemberRole } from "@prisma/client";
import { Edit, Mic, Trash, AtSign, Home } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { ModalType, useModal } from "@/hooks/use-modal-store";
import { SlashSVG } from "@/lib/slash";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";
import { VoiceChannelParticipants } from "./voice-channel-participants";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useTranslation } from "@/i18n";
import { useMainChannelLastMessage } from "@/hooks/use-main-channel-last-message";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { useProfile } from "@/components/app-shell/providers/profile-provider";

interface LeftbarChannelProps {
  channel: {
    id: string;
    name: string;
    type: ChannelType;
    position: number;
    parentId: string | null;
  };
  boardId: string;
  role?: MemberRole;
}

// Optimización #6: Memoizar componente
const LeftbarChannelComponent = ({
  channel,
  boardId,
  role,
}: LeftbarChannelProps) => {
  const { onOpen } = useModal();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();
  const profile = useProfile();

  // Lazy-mount tooltips once per channel to avoid paying Radix Popper setup costs
  // for every channel during navigation/mount. Keep behavior equivalent after first hover.
  const [tooltipsEnabled, setTooltipsEnabled] = useState(false);
  const canHover = useMemo(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    return mq?.matches ?? false;
  }, []);
  const enableTooltipsOnce = useCallback(() => {
    if (!canHover) return;
    setTooltipsEnabled(true);
  }, [canHover]);

  // Selector derivado: solo re-renderiza cuando cambia el estado "activo" de ESTE canal.
  const isActive = useBoardNavigationStore(
    useCallback(
      (state) => !state.isDiscovery && state.currentChannelId === channel.id,
      [channel.id],
    ),
  );

  // Usados solo en el handler; deberían cambiar solo una vez (hydration).
  const isClientNavigationEnabled = useBoardNavigationStore(
    (state) => state.isClientNavigationEnabled,
  );
  const switchChannel = useBoardNavigationStore((state) => state.switchChannel);

  // Zustand con selectores - solo re-render cuando cambia ESTE canal
  const unreadCount = useUnreadStore(
    useCallback((state) => state.unreads[channel.id] || 0, [channel.id]),
  );
  const hasMentionInChannel = useMentionStore(
    useCallback((state) => state.mentions[channel.id] === true, [channel.id]),
  );

  // MAIN y TEXT son canales de texto
  const isMainChannel = channel.type === ChannelType.MAIN;
  const isText = channel.type === ChannelType.TEXT || isMainChannel;
  const hasUnread = unreadCount > 0;

  // Obtener último mensaje solo para canal MAIN
  const { lastMessage } = useMainChannelLastMessage({
    channelId: channel.id,
    boardId,
    profileId: profile.id,
    enabled: isMainChannel,
  });

  // Memoizar preview del último mensaje
  const lastMessagePreview = useMemo(() => {
    if (!lastMessage) return t.dm.noMessagesYet;
    if (lastMessage.deleted) return t.dm.messageDeleted;

    const username = lastMessage.member?.profile?.username || "";
    let preview = "";

    if (lastMessage.hasAttachment || lastMessage.attachmentAsset) {
      preview = `📎 ${t.dm.sentAFile}`;
    } else {
      const maxLength = 30;
      if (lastMessage.content.length > maxLength) {
        preview = lastMessage.content.substring(0, maxLength) + "...";
      } else {
        preview = lastMessage.content;
      }
    }

    return username ? `${username}: ${preview}` : preview;
  }, [lastMessage, t.dm.noMessagesYet, t.dm.messageDeleted, t.dm.sentAFile]);

  const onClick = () => {
    const isVoice = channel.type === ChannelType.VOICE;

    // Only VOICE channels read from the voice store (and only at click-time).
    // Also avoid subscribing this list item to voice state changes.
    const isInThisVoiceChannel = isVoice
      ? (() => {
          const voiceState = useVoiceStore.getState();
          return (
            voiceState.channelId === channel.id &&
            (voiceState.isConnected || voiceState.isConnecting)
          );
        })()
      : false;

    // For VOICE channels:
    // - If NOT in this voice channel → just join (don't navigate)
    // - If already in this voice channel → navigate to the view
    if (isVoice && !isInThisVoiceChannel) {
      // Just start connecting to the voice channel without navigating
      useVoiceStore
        .getState()
        .startConnecting(channel.id, channel.name, "board", boardId);
      return;
    }

    // For TEXT/MAIN channels OR if already in the voice channel → navigate
    startTransition(() => {
      if (isClientNavigationEnabled) {
        switchChannel(channel.id);
      } else {
        window.location.href = `/boards/${boardId}/rooms/${channel.id}`;
      }
    });
  };

  const onAction = (e: React.MouseEvent, action: ModalType) => {
    e.stopPropagation();
    onOpen(action, {
      channel,
      boardId,
    });
  };

  // Priorizar el contexto SPA sobre los params de URL (params puede estar desactualizado con pushState)
  // Si el contexto está disponible, usarlo exclusivamente para determinar el estado activo
  // Esto evita que el canal anterior aparezca como activo cuando navegamos a discovery o conversación
  const isVoiceChannel = channel.type === ChannelType.VOICE;

  return (
    <div className="w-full">
      <button
        onClick={onClick}
        onMouseEnter={enableTooltipsOnce}
        className={cn(
          "group w-[calc(100%)] flex cursor-pointer items-center rounded-[6px] px-0 transition text-left",

          // Mayor altura para canal MAIN
          channel.type === ChannelType.MAIN ? "py-2" : "py-2",

          // Editorial hover: underline + soft background on hover
          "hover:bg-theme-channel-hover",

          // Active = editorial highlight + bold + stronger underline
          isActive &&
            "bg-theme-channel-active border-l-4 border-theme-border-accent-active-channel",
        )}
      >
        {/* ICONO HOME centrado verticalmente (solo para MAIN) */}
        {isMainChannel && (
          <Home
            className={cn(
              "w-7.5 h-7.5 text-theme-text-tertiary shrink-0 ml-1 self-center",
              isActive && "text-theme-accent-primary",
            )}
          />
        )}

        {/* CONTENIDO: ICONO + NOMBRE (+ PREVIEW para MAIN) */}
        <div
          className={cn(
            "flex items-center flex-1 min-w-0",
            isMainChannel && "flex-col items-start gap-0.5",
          )}
        >
          <div className="flex items-center">
            {/* ICON (solo para TEXT y VOICE) */}
            {!isMainChannel &&
              (isText ? (
                <SlashSVG
                  className={cn(
                    "w-5 h-5 text-theme-text-tertiary shrink-0",
                    isActive && "text-theme-accent-primary",
                  )}
                />
              ) : (
                <Mic
                  className={cn(
                    "w-5 h-5 text-theme-text-tertiary shrink-0 ml-0.5",
                    isActive && "text-theme-accent-primary",
                  )}
                />
              ))}

            {/* NOMBRE DEL CANAL */}
            <p
              className={cn(
                "line-clamp-1 font-medium text-theme-text-primary transition overflow-hidden text-ellipsis",

                // Tamaño de texto: MAIN más grande
                channel.type === ChannelType.MAIN
                  ? "text-[16px]"
                  : "text-[14px]",

                // Margin izquierdo: MAIN tiene más espacio, texto tiene menos, voz tiene más
                channel.type === ChannelType.MAIN
                  ? "ml-1"
                  : isText
                    ? "-ml-0.5"
                    : "ml-0.5",

                // Editorial hover: underline
                "group-hover:underline underline-offset-4",

                isActive &&
                  "font-semibold text-theme-accent-primary underline underline-offset-4",
              )}
            >
              {channel.name}
            </p>
          </div>

          {/* PREVIEW DEL ÚLTIMO MENSAJE (solo para MAIN) */}
          {isMainChannel && (
            <span className="text-xs text-theme-text-tertiary truncate w-full text-left pl-1">
              {lastMessagePreview}
            </span>
          )}
        </div>

        {/* INDICADOR DE MENCIÓN */}
        {hasMentionInChannel && !isActive && (
          <div className="min-w-[18px] h-[18px] px-1 bg-[#E57373] rounded-full mr-1 flex items-center justify-center">
            <AtSign className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}

        {/* CONTADOR DE MENSAJES NO LEÍDOS */}
        {hasUnread && !isActive && (
          <div className="min-w-[18px] h-[18px] px-1 bg-[#D6A86C] rounded-full mr-2 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#3A3027] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </div>
        )}

        {/* ACCIONES */}
        {role !== MemberRole.GUEST && (
          <div className="ml-auto mr-2 items-center gap-2 hidden group-hover:flex transition">
            {tooltipsEnabled ? (
              <ActionTooltip label={t.board.editChannel}>
                <Edit
                  onClick={(e) => onAction(e, "editChannel")}
                  className="w-4 h-4 text-theme-text-tertiary hover:text-theme-text-primary transition"
                />
              </ActionTooltip>
            ) : (
              <Edit
                onClick={(e) => onAction(e, "editChannel")}
                className="w-4 h-4 text-theme-text-tertiary hover:text-theme-text-primary transition"
              />
            )}

            {/* No mostrar delete en canal MAIN */}
            {!isMainChannel && (
              <>
                {tooltipsEnabled ? (
                  <ActionTooltip label={t.board.deleteChannel}>
                    <Trash
                      onClick={(e) => onAction(e, "deleteChannel")}
                      className="w-4 h-4 text-theme-text-tertiary hover:text-red-400 transition"
                    />
                  </ActionTooltip>
                ) : (
                  <Trash
                    onClick={(e) => onAction(e, "deleteChannel")}
                    className="w-4 h-4 text-theme-text-tertiary hover:text-red-400 transition"
                  />
                )}
              </>
            )}
          </div>
        )}
      </button>

      {/* PARTICIPANTES DE VOICE CHANNEL */}
      {isVoiceChannel && <VoiceChannelParticipants channelId={channel.id} />}
    </div>
  );
};

// Export memoizado con comparación personalizada
export const LeftbarChannel = memo(LeftbarChannelComponent, (prev, next) => {
  return (
    prev.channel.id === next.channel.id &&
    prev.channel.name === next.channel.name &&
    prev.channel.type === next.channel.type &&
    prev.channel.position === next.channel.position &&
    prev.role === next.role
  );
});
