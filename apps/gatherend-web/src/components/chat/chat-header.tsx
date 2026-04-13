"use client";

import { memo, type CSSProperties } from "react";
import { ChatVideoButton } from "./chat-video-button";
import { PinnedMessagesButton } from "./pinned-messages-button";
import { ChatHeaderClient } from "./chat-header-client";
import { ChannelType } from "@prisma/client";
import { ChatFullscreenButton } from "./chat-fullscreen-button";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { ArrowLeft } from "lucide-react";
import { useBoardSwitchNavigation } from "@/contexts/board-switch-context";
import { ActionTooltip } from "@/components/action-tooltip";

// Nota: MobileToggle fue removido porque en la arquitectura SPA,
// los sidebars están siempre disponibles en el layout.
// Si se necesita mobile toggle en el futuro, crear una versión cliente.

interface ChatHeaderProps {
  boardId: string;
  name: string;
  type: "channel" | "conversation";
  avatarUrl?: string;
  style?: CSSProperties;
  profileId?: string; // Para mostrar el status en conversaciones
  channelType?: ChannelType;
  channelId?: string;
  conversationId?: string;
}
const ChatHeaderComponent = ({
  boardId,
  name,
  type,
  avatarUrl,
  profileId,
  channelType,
  channelId,
  conversationId,
  style,
}: ChatHeaderProps) => {
  const resolvedStyle = {
    "--community-header-bg-base": "var(--theme-bg-quaternary)",
    "--community-header-bg-top":
      "color-mix(in srgb, white 18%, var(--theme-bg-quaternary) 82%)",
    "--community-header-bg-mid":
      "color-mix(in srgb, white 8%, var(--theme-bg-quaternary) 92%)",
    "--community-header-bg-bottom":
      "color-mix(in srgb, black 18%, var(--theme-bg-quaternary) 82%)",
    "--community-header-highlight": "rgba(255,255,255,0.24)",
    "--community-header-shadow": "rgba(0,0,0,0.28)",
    "--community-header-btn-bg": "var(--theme-chat-input-button-bg)",
    "--community-header-btn-hover": "var(--theme-chat-input-surface-bg)",
    "--community-header-btn-text": "var(--theme-text-secondary)",
    "--community-header-btn-muted": "var(--theme-text-tertiary)",
    "--community-header-btn-ring": "var(--theme-border-secondary)",
    "--community-header-border": "var(--theme-chat-input-button-bg)",
    ...style,
    backgroundColor: "var(--community-header-bg-base)",
    backgroundImage:
      "linear-gradient(180deg, var(--community-header-bg-top) 0%, var(--community-header-bg-mid) 52%, var(--community-header-bg-bottom) 100%)",
  } as CSSProperties;

  const {
    isConnected: isVoiceConnected,
    isConnecting: isVoiceConnecting,
    channelId: activeVoiceChannelId,
    context: voiceContext,
  } = useVoiceStore();
  const { switchToChannelList } = useBoardSwitchNavigation();

  const isVoiceChannel =
    type === "channel" && channelType === ChannelType.VOICE;
  const canFullscreen =
    isVoiceChannel &&
    Boolean(channelId) &&
    voiceContext === "board" &&
    activeVoiceChannelId === channelId &&
    (isVoiceConnected || isVoiceConnecting);

  return (
    <div
      className="hidden h-12 shrink-0 items-center border-b border-theme-border-primary bg-theme-bg-quaternary px-3 md:flex"
      style={resolvedStyle}
    >
      {/* MobileToggle removido - sidebars disponibles en layout SPA */}
      {type === "channel" && (
        <ActionTooltip side="bottom" label="Volver a la lista de chats">
          <button
            type="button"
            onClick={() => switchToChannelList(boardId)}
            className="mr-2 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-[var(--community-header-btn-ring)] bg-[var(--community-header-btn-bg,var(--theme-bg-secondary))] text-theme-text-subtle shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)] transition hover:bg-[var(--community-header-btn-hover)] hover:text-theme-text-light"
            aria-label="Volver a la lista de chats"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </ActionTooltip>
      )}
      <ChatHeaderClient
        boardId={boardId}
        name={name}
        type={type}
        avatarUrl={avatarUrl}
        profileId={profileId}
        channelId={channelId}
      />
      <div className="ml-auto flex items-center gap-x-2">
        {isVoiceChannel ? (
          <ChatFullscreenButton
            targetId={channelId ? `voice-media-room-${channelId}` : undefined}
            disabled={!canFullscreen}
          />
        ) : (
          <PinnedMessagesButton
            channelId={channelId}
            conversationId={conversationId}
            type={type}
          />
        )}
        {type === "conversation" && conversationId && (
          <ChatVideoButton
            conversationId={conversationId}
            otherProfileName={name}
          />
        )}
        {/*<SocketIndicator />*/}
      </div>
    </div>
  );
};

export const ChatHeader = memo(ChatHeaderComponent);
