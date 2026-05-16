"use client";

import { useEffect, useMemo } from "react";
import { ChannelType } from "@prisma/client";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ConditionalMediaRoom } from "@/components/conditional-media-room";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useAutoMarkAsRead } from "@/hooks/use-auto-mark-as-read";
import {
  useCurrentBoardData,
  useBoardChannelsMap,
} from "@/hooks/use-board-data";
import { useBoardSwitchNavigation } from "@/contexts/board-switch-context";
import { ForumView } from "./forum-view";
import { WikiView } from "./wiki-view";

interface ChannelViewProps {
  /** ID del canal (desde CenterContentRouter via BoardSwitchContext) */
  channelId: string;
  /** ID del board (desde CenterContentRouter via BoardSwitchContext) */
  boardId: string;
}

/**
 * ChannelView - Vista del canal de chat
 *
 * Componente cliente que renderiza el chat de un canal.
 * Obtiene datos via React Query y hooks de contexto.
 */
export function ChannelView({ channelId, boardId }: ChannelViewProps) {
  const profile = useProfile();
  const { switchBoardView } = useBoardSwitchNavigation();

  useAutoMarkAsRead(channelId, false);

  const { data: board, isLoading: boardLoading } = useCurrentBoardData();

  const channelsMap = useBoardChannelsMap(board);

  const channel = channelsMap.get(channelId);
  const member =
    board?.currentMember?.profileId === profile.id ? board.currentMember : null;

  const isStaleBoard = Boolean(board && board.id !== boardId);

  const resolvedChannelId = channel?.id ?? "";
  const resolvedBoardId = board?.id ?? "";

  const socketQuery = useMemo(
    () => ({
      channelId: resolvedChannelId,
      boardId: resolvedBoardId,
    }),
    [resolvedChannelId, resolvedBoardId],
  );

  const inputQuery = useMemo(
    () => ({
      channelId: resolvedChannelId,
      boardId: resolvedBoardId,
    }),
    [resolvedChannelId, resolvedBoardId],
  );

  const chatQueryKey = useMemo(
    () => ["chat", "channel", resolvedChannelId],
    [resolvedChannelId],
  );

  useEffect(() => {
    if (boardLoading || !board || isStaleBoard || channel) return;

    switchBoardView(boardId, { kind: "channels:list" }, { history: "replace" });
  }, [boardLoading, board, isStaleBoard, channel, switchBoardView, boardId]);

  if (boardLoading || !channel || !board || isStaleBoard) {
    return null;
  }

  // Route to channel-type-specific views
  if (channel.type === ChannelType.FORUM) {
    return <ForumView channelId={channel.id} boardId={board.id} />;
  }
  if (channel.type === ChannelType.WIKI) {
    return <WikiView channelId={channel.id} boardId={board.id} />;
  }

  const channelBackgroundImageUrl = channel.imageAsset?.url ?? null;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        boardId={channel.boardId}
        type="channel"
        channelType={channel.type}
        channelId={channel.id}
      />
      {channel.type === ChannelType.TEXT && (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {channelBackgroundImageUrl && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${channelBackgroundImageUrl})`,
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-theme-bg-tertiary/65"
              />
            </>
          )}

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <ChatMessages
              name={channel.name}
              currentProfile={profile}
              currentMember={member}
              board={board}
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/messages`}
              socketQuery={socketQuery}
              paramKey="channelId"
              paramValue={channel.id}
              type="channel"
            />
            <ChatInput
              name={channel.name}
              type="channel"
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/messages`}
              currentProfile={profile}
              query={inputQuery}
              chatQueryKey={chatQueryKey}
              roomId={channel.id}
            />
          </div>
        </div>
      )}
      <ConditionalMediaRoom
        channelId={channel.id}
        channelName={channel.name}
        channelType={channel.type}
        boardId={board.id}
      />
    </div>
  );
}
