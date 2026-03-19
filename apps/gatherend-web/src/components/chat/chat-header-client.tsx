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
    <div className="flex min-w-[160px] items-center justify-start gap-2 bg-transparent px-0 py-0.5">
      {type === "channel" && (
        <SlashSVG className="h-4 w-4 -mr-2 text-theme-text-tertiary" />
      )}
      {type === "conversation" && (
        <UserAvatar
          src={avatarUrl}
          profileId={profileId}
          className="h-6 w-6 md:h-6 md:w-6"
          statusOffset="right-0"
          ringColorClass="indicator-ring"
          overlayRingColorClass="bg-theme-bg-tertiary"
          animationMode="never"
        />
      )}
      <p className="text-center text-[16px] font-semibold text-theme-text-subtle">
        {name}
      </p>
    </div>
  );
};
