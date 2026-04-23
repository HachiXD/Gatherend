"use client";

import { Phone, PhoneOff } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useTranslation } from "@/i18n";
import { useVoiceStore } from "@/hooks/use-voice-store";

interface ChatVideoButtonProps {
  conversationId: string;
  otherProfileName: string;
}

export const ChatVideoButton = ({
  conversationId,
  otherProfileName,
}: ChatVideoButtonProps) => {
  const { t } = useTranslation();
  const {
    isConnecting,
    isConnected,
    channelId,
    context,
    startConnecting,
    leaveVoice,
  } = useVoiceStore();

  // Check if we're connecting or connected to THIS conversation
  const isThisChannel =
    channelId === conversationId && context === "conversation";
  const isInThisCall = isThisChannel && isConnected;
  const isConnectingToThis = isThisChannel && isConnecting;

  const onClick = () => {
    if (isInThisCall || isConnectingToThis) {
      leaveVoice();
    } else {
      startConnecting(conversationId, otherProfileName, "conversation");
    }
  };

  const Icon = isInThisCall || isConnectingToThis ? PhoneOff : Phone;
  const tooltipLabel =
    isInThisCall || isConnectingToThis
      ? t.chat.endVoiceCall
      : t.chat.startVoiceCall;

  return (
    <ActionTooltip side="bottom" label={tooltipLabel}>
      <button
        onClick={onClick}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[var(--community-header-btn-muted)] transition hover:bg-theme-app-settings-hover hover:text-[var(--community-header-btn-text)]"
      >
        <Icon className="h-6 w-6" />
      </button>
    </ActionTooltip>
  );
};
