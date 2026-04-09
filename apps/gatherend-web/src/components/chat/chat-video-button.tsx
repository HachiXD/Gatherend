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
        className="flex h-8 w-8 cursor-pointer items-center justify-center border border-[var(--community-header-btn-ring)] bg-[var(--community-header-btn-bg)] text-[var(--community-header-btn-muted)] transition hover:bg-[var(--community-header-btn-hover)] hover:text-[var(--community-header-btn-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]"
      >
        <Icon className="h-5 w-5" />
      </button>
    </ActionTooltip>
  );
};
