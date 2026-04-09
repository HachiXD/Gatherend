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
  const isConversation = type === "conversation";

  return (
    <div
      className={`flex min-w-[160px] items-center justify-center gap-2 border border-[var(--community-header-btn-ring)] px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)] ${isConversation ? "bg-theme-bg-secondary/40" : ""}`}
      style={isConversation ? undefined : { backgroundColor: "var(--community-header-btn-bg, var(--theme-bg-secondary))" }}
    >
      {type === "channel" && (
        <SlashSVG className="h-4 w-4 -mr-2 text-theme-text-tertiary" />
      )}
      {type === "conversation" && (
        <UserAvatar
          src={avatarUrl}
          profileId={profileId}
          className="h-5 w-5 md:h-5 md:w-5"
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
