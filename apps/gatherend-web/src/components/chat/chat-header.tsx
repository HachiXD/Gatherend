"use client";

import { memo, type CSSProperties } from "react";
import { SocketIndicator } from "@/components/socket-indicator";
import { ChatVideoButton } from "./chat-video-button";
import { PinnedMessagesButton } from "./pinned-messages-button";
import { ChatHeaderClient } from "./chat-header-client";
import { ChannelType } from "@prisma/client";
import { ChatFullscreenButton } from "./chat-fullscreen-button";
import { useVoiceStore } from "@/hooks/use-voice-store";

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
  const {
    isConnected: isVoiceConnected,
    isConnecting: isVoiceConnecting,
    channelId: activeVoiceChannelId,
    context: voiceContext,
  } = useVoiceStore();

  const isVoiceChannel =
    type === "channel" && channelType === ChannelType.VOICE;
  const canFullscreen =
    isVoiceChannel &&
    Boolean(channelId) &&
    voiceContext === "board" &&
    activeVoiceChannelId === channelId &&
    (isVoiceConnected || isVoiceConnecting);

  return (
    <div className="hidden h-12 shrink-0 items-center bg-theme-bg-quaternary px-3 md:flex border-b border-theme-border" style={style}>
      {/* MobileToggle removido - sidebars disponibles en layout SPA */}
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
