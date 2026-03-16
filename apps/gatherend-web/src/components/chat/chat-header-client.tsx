"use client";

import { UserAvatar } from "@/components/user-avatar";
import { SlashSVG } from "@/lib/slash";
import { useChannelData } from "@/hooks/use-board-data";

interface ChatHeaderClientProps {
  boardId: string;
  name: string;
  type: "channel" | "conversation";
  avatarUrl?: string;
  profileId?: string;
  channelId?: string;
}

export const ChatHeaderClient = ({
  boardId,
  name: initialName,
  type,
  avatarUrl,
  profileId,
  channelId,
}: ChatHeaderClientProps) => {
  // Para canales, usar datos reactivos desde el cache de React Query
  const { channel } = useChannelData(boardId, channelId || "");

  // Usar el nombre del cache si está disponible, sino usar el prop inicial
  const name = type === "channel" && channel ? channel.name : initialName;

  return (
    <>
      {type === "channel" && (
        <SlashSVG className="w-5 h-5 text-theme-text-tertiary" />
      )}
      {type === "conversation" && (
        <UserAvatar
          src={avatarUrl}
          profileId={profileId}
          className="h-8 w-8 md:h-8 md:w-8 mr-2"
          statusOffset="right-2"
          ringColorClass="indicator-ring"
          overlayRingColorClass="bg-theme-bg-quaternary"
          animationMode="never"
        />
      )}
      <p className="font-semibold text-md text-theme-text-primary">{name}</p>
    </>
  );
};
