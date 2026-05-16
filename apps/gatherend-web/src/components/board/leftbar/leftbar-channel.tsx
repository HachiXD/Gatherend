"use client";

import { memo, useTransition, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChannelType, MemberRole } from "@prisma/client";
import { isAdmin } from "@/lib/domain-client";
import {
  BookOpen,
  Edit,
  MessageSquare,
  Mic,
  Trash,
  AtSign,
} from "lucide-react";
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

  const isVoiceChannel = channel.type === ChannelType.VOICE;
  const isTextChannel = channel.type === ChannelType.TEXT;
  const isForumOrWikiChannel =
    channel.type === ChannelType.FORUM || channel.type === ChannelType.WIKI;
  const hasUnread = unreadCount > 0;
  const canManageChannel = isAdmin(role as MemberRole);

  const ChannelIcon =
    channel.type === ChannelType.VOICE
      ? Mic
      : channel.type === ChannelType.FORUM
        ? MessageSquare
        : channel.type === ChannelType.WIKI
          ? BookOpen
          : null;

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

  return (
    <div className="w-full min-w-0">
      <button
        onClick={onClick}
        onMouseEnter={enableTooltipsOnce}
        className={cn(
          "group flex w-full min-w-0 max-w-full cursor-pointer items-center overflow-hidden rounded-lg px-1.5 py-1.5 text-left transition",
          isActive
            ? "bg-theme-channel-active border-l-4 border-theme-border-accent-active-channel"
            : "hover:bg-theme-channel-hover",
        )}
      >
        {/* ICON */}
        {isTextChannel ? (
          <SlashSVG
            className={cn(
              "w-5 h-5 shrink-0 text-theme-text-tertiary",
              isActive && "text-theme-accent-primary",
            )}
          />
        ) : ChannelIcon ? (
          <ChannelIcon
            className={cn(
              "w-5 h-5 shrink-0 ml-0.5 text-theme-text-tertiary",
              isActive && "text-theme-accent-primary",
            )}
          />
        ) : (
          <SlashSVG
            className={cn(
              "w-5 h-5 shrink-0 text-theme-text-tertiary",
              isActive && "text-theme-accent-primary",
            )}
          />
        )}

        {/* NOMBRE DEL CANAL */}
        <p
          className={cn(
            "min-w-0 flex-1 truncate font-medium text-[14.5px] text-theme-text-primary transition",
            isTextChannel
              ? "-ml-0.5"
              : isForumOrWikiChannel
                ? "ml-1.5"
                : "ml-0.5",
            !isActive && "group-hover:underline underline-offset-4",
            isActive &&
              "font-semibold text-theme-accent-primary underline underline-offset-4",
          )}
        >
          {channel.name}
        </p>

        {/* INDICADOR DE MENCIÓN */}
        {hasMentionInChannel && !isActive && (
          <div className="mr-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-theme-notification-bg">
            <AtSign
              className="w-3 h-3 ml-0.5 text-theme-text-tertiary"
              strokeWidth={3}
            />
          </div>
        )}

        {/* INDICADOR DE MENSAJES NO LEÍDOS */}
        {hasUnread && !isActive && (
          <div className="mr-1 w-2.5 h-2.5 bg-theme-unread-bg rounded-full shrink-0" />
        )}

        {/* ACCIONES */}
        {canManageChannel && (
          <div className="ml-auto mr-1 hidden shrink-0 items-center gap-2 transition group-hover:flex">
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
    prev.role === next.role
  );
});
