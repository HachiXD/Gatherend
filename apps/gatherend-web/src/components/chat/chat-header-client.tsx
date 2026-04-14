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
    <div
      className={`flex min-w-[160px] items-center justify-center gap-2 rounded-sm border border-[var(--community-header-btn-ring)] bg-theme-bg-secondary/40 px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]`}
      style={undefined}
    >
      {type === "channel" && (
        <SlashSVG className="h-6 w-6 -mr-2 text-theme-text-tertiary" />
      )}
      {type === "conversation" && (
        <UserAvatar
          src={avatarUrl}
          profileId={profileId}
          className="h-6.5 w-6.5"
          statusOffset="right-0"
          statusClassName="w-2.5 h-2.5"
          ringColorClass="indicator-ring"
          overlayRingColorClass="bg-theme-bg-tertiary"
          animationMode="never"
        />
      )}
      <p className="text-center text-[20px] font-semibold text-theme-text-subtle">
        {name}
      </p>
    </div>
  );
};
