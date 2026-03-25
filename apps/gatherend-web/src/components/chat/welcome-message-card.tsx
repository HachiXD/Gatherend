"use client";

import { memo } from "react";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";
import { useTranslation } from "@/i18n";

interface WelcomeMessageCardProps {
  boardName: string;
  username?: string;
}

export const WelcomeMessageCard = memo(
  function WelcomeMessageCard({
    boardName,
    username,
  }: WelcomeMessageCardProps) {
    const { t } = useTranslation();

    return (
      <div className="flex flex-col items-center text-center py-6 opacity-90">
        <div className="relative w-28 h-28 mb-3">
          <div className="absolute inset-0 rounded-full bg-theme-bg-quaternary" />
          <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-4 text-theme-accent-light" />
        </div>

        <p className="text-theme-text-subtle text-sm px-4">
          {username && (
            <>
              <span className="font-semibold">@{username}</span>{" "}
              {t.chat.welcomeJoined}{" "}
            </>
          )}
          <span className="font-semibold">{boardName}</span>!
          <br />
          {t.chat.welcomeHopeGoodTime}
        </p>
      </div>
    );
  },
  (prev, next) =>
    prev.boardName === next.boardName && prev.username === next.username,
);
