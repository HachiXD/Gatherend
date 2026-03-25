"use client";

import { memo } from "react";
import { SlashSVG } from "@/lib/slash";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";
import { useTranslation } from "@/i18n";

interface ChatWelcomeProps {
  name: string;
  type: "channel" | "conversation";
  boardId?: string;
  channelId?: string;
}

export const ChatWelcome = memo(function ChatWelcome({
  name,
  type,
  boardId: _boardId,
  channelId: _channelId,
}: ChatWelcomeProps) {
  const isChannel = type === "channel";
  const { t } = useTranslation();

  return (
    <div className="space-y-4 px-4 mb-4 flex flex-col items-center text-center">
      {/* TOP TEXT: Greetings */}
      <p className="text-xl text-theme-text-subtle md:text-3xl font-bold">
        {isChannel ? `${t.chat.greetingsThisIs}` : ""}
        {name}
      </p>

      {/* SVG LOGO CENTERED */}
      <div className="relative w-50 h-50">
        <div className="absolute inset-0 rounded-full bg-theme-bg-quaternary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-5 text-theme-accent-light" />
      </div>

      {/* BOTTOM TEXT: description */}
      <p className="text-theme-text-subtle text-[16px] max-w-[360px]">
        {isChannel ? (
          <>
            {t.chat.hopeGreatTimeIn} <span className="font-bold">{name}</span>.{" "}
            {t.chat.shareAndEnjoy}
          </>
        ) : (
          t.chat.wishingGreatConversation
        )}
      </p>
    </div>
  );
});
