"use client";

import { memo, useTransition, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChannelType, MemberRole } from "@prisma/client";
import { Edit, Mic, Trash, AtSign, Users } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { ModalType, useModal } from "@/hooks/use-modal-store";
import { SlashSVG } from "@/lib/slash";
import { useUnreadStore } from "@/hooks/use-unread-store";
import { useMentionStore } from "@/hooks/use-mention-store";
import { VoiceChannelParticipants } from "./voice-channel-participants";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useTranslation } from "@/i18n";
import { useVoiceStore } from "@/hooks/use-voice-store";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface LeftbarChannelProps {
  channel: {
    id: string;
    name: string;
    type: ChannelType;
    position: number;
    parentId: string | null;
    imageAsset?: ClientUploadedAsset | null;
    channelMemberCount?: number;
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

  const isText = channel.type === ChannelType.TEXT;
  const hasUnread = unreadCount > 0;
  const canManageChannel =
    role === MemberRole.OWNER || role === MemberRole.ADMIN;

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

    // For TEXT channels OR if already in the voice channel → navigate
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
  const channelImageUrl = channel.imageAsset?.url ?? null;

  return (
    <div className="w-full min-w-0">
      <button
        onClick={onClick}
        onMouseEnter={enableTooltipsOnce}
        style={
          channelImageUrl
            ? { backgroundImage: `url(${channelImageUrl})` }
            : undefined
        }
        className={cn(
          "group relative flex h-26 w-full min-w-0 max-w-full cursor-pointer items-center overflow-hidden rounded-sm border border-theme-channel-type-active-border px-0 text-left transition",
          channelImageUrl
            ? [
                "bg-cover bg-center bg-no-repeat",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]",
                isActive &&
                  "shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]",
              ]
            : [
                "bg-theme-channel-type-active-border shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]",
                !isActive && "hover:bg-theme-channel-type-active-border",
                isActive && "bg-theme-button-primary",
                isActive &&
                  "shadow-[inset_0_1px_0_rgba(0,0,0,0.42),inset_1px_0_0_rgba(0,0,0,0.36),inset_-1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.18)]",
              ],
          channelImageUrl &&
            isActive &&
            "border-l-4 border-theme-channel-type-active-border",
        )}
      >
        {/* Overlay oscuro cuando hay imagen de fondo */}
        {channelImageUrl && (
          <div
            className={cn(
              "absolute inset-0 pointer-events-none transition",
              isActive ? "bg-black/50" : "bg-black/45 group-hover:bg-black/35",
            )}
          />
        )}

        {/* CONTENIDO: ICONO + NOMBRsE */}
        <div className=" relative flex flex-1 ml-1 min-w-0 overflow-hidden items-center">
          <div className="flex w-full min-w-0 items-center">
            {/* NOMBRE + CONTADOR */}
            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <div className="flex min-w-0 items-center">
                {/* ICON */}
                {isText ? (
                  <SlashSVG
                    className={cn(
                      "w-7 h-7 shrink-0 text-theme-text-subtle",
                      isActive && "text-theme-accent-primary",
                    )}
                  />
                ) : (
                  <Mic
                    className={cn(
                      "w-7 h-7 shrink-0 ml-0.5 text-theme-text-tertiary",
                      isActive && "text-theme-accent-primary",
                    )}
                  />
                )}
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium text-[20px] text-theme-text-primary transition",
                    isText ? "-ml-0.5" : "ml-0.5",
                    !isActive && "group-hover:underline underline-offset-4",
                    isActive &&
                      "font-semibold text-theme-accent-primary underline underline-offset-4",
                  )}
                >
                  {channel.name}
                </p>
              </div>
              {isText && (
                <span className="flex ml-2 items-center gap-1 text-[16px] text-theme-text-subtle">
                  <Users className="w-5 h-5" />
                  {channel.channelMemberCount == null ||
                  channel.channelMemberCount === 0
                    ? "Sin miembros"
                    : `${channel.channelMemberCount} ${channel.channelMemberCount === 1 ? "miembro" : "miembros"}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* INDICADOR DE MENCIÓN */}
        {hasMentionInChannel && !isActive && (
          <div className="relative mr-2 flex h-[18px] w-[18px] pr-0.5  shrink-0 items-center justify-center rounded-full bg-theme-notification-bg">
            <AtSign
              className="w-3 h-3 ml-0.5 text-theme-text-tertiary"
              strokeWidth={3}
            />
          </div>
        )}

        {/* INDICADOR DE MENSAJES NO LEÍDOS */}
        {hasUnread && !isActive && (
          <div className="relative mr-2 w-2.5 h-2.5 bg-theme-unread-bg rounded-full shrink-0" />
        )}

        {/* ACCIONES */}
        {canManageChannel && (
          <div className="relative ml-auto mr-2 hidden shrink-0 items-center gap-2 transition group-hover:flex">
            {tooltipsEnabled ? (
              <ActionTooltip label={t.board.editChannel}>
                <Edit
                  onClick={(e) => onAction(e, "editChannel")}
                  className="w-6 h-6 text-theme-text-tertiary hover:text-theme-text-primary transition"
                />
              </ActionTooltip>
            ) : (
              <Edit
                onClick={(e) => onAction(e, "editChannel")}
                className="w-6 h-6 text-theme-text-tertiary hover:text-theme-text-primary transition"
              />
            )}

            {tooltipsEnabled ? (
              <ActionTooltip label={t.board.deleteChannel}>
                <Trash
                  onClick={(e) => onAction(e, "deleteChannel")}
                  className="w-6 h-6 text-theme-text-tertiary hover:text-red-400 transition"
                />
              </ActionTooltip>
            ) : (
              <Trash
                onClick={(e) => onAction(e, "deleteChannel")}
                className="w-6 h-6 text-theme-text-tertiary hover:text-red-400 transition"
              />
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
    prev.channel.imageAsset?.id === next.channel.imageAsset?.id &&
    prev.channel.channelMemberCount === next.channel.channelMemberCount &&
    prev.role === next.role
  );
});
