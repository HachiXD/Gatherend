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
    "--community-header-btn-bg": "var(--theme-chat-input-button-bg)",
    "--community-header-btn-hover": "var(--theme-chat-input-surface-bg)",
    "--community-header-btn-text": "var(--theme-text-secondary)",
    "--community-header-btn-muted": "var(--theme-text-tertiary)",
    "--community-header-btn-ring": "var(--theme-border-secondary)",
    "--community-header-border": "var(--theme-chat-input-button-bg)",
    ...style,
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
      className="hidden h-[45px] shrink-0 items-center border-b border-theme-border-primary bg-theme-bg-quinary px-3 md:flex"
      style={resolvedStyle}
    >
      {/* MobileToggle removido - sidebars disponibles en layout SPA */}
      {type === "channel" && (
        <ActionTooltip side="bottom" label="Volver a la lista de chats">
          <button
            type="button"
            onClick={() => switchToChannelList(boardId)}
            className="mr-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-theme-text-subtle transition hover:bg-theme-app-settings-hover hover:text-theme-text-light"
            aria-label="Volver a la lista de chats"
          >
            <ArrowLeft className="h-6 w-6" />
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
