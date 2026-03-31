"use client";

import { useCallback, useMemo, useState } from "react";
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
  useBoardMembersMap,
} from "@/hooks/use-board-data";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [isJoining, setIsJoining] = useState(false);

  useAutoMarkAsRead(channelId, false);

  const { data: board, isLoading: boardLoading } = useCurrentBoardData();

  const channelsMap = useBoardChannelsMap(board);
  const membersMap = useBoardMembersMap(board);

  const channel = channelsMap.get(channelId);
  const member = useMemo(() => membersMap.get(profile.id), [membersMap, profile.id]);

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

  const handleJoinChannel = useCallback(async () => {
    if (isJoining || !board || !channel) return;
    setIsJoining(true);
    try {
      await fetch(`/api/boards/${board.id}/channels/${channel.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      await queryClient.invalidateQueries({ queryKey: ["board", board.id] });
    } finally {
      setIsJoining(false);
    }
  }, [isJoining, board, channel, queryClient]);

  if (boardLoading || !channel || !board || isStaleBoard) {
    return null;
  }

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
        <>
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
          {channel.isJoined ? (
            <ChatInput
              name={channel.name}
              type="channel"
              apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/messages`}
              currentProfile={profile}
              query={inputQuery}
              chatQueryKey={chatQueryKey}
              roomId={channel.id}
            />
          ) : (
            <div className="px-4 py-3 border-t border-theme-border">
              <button
                onClick={handleJoinChannel}
                disabled={isJoining}
                className="w-full h-11 cursor-pointer rounded-none border border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              >
                {isJoining ? "Uniéndose..." : "Unirme al chat"}
              </button>
            </div>
          )}
        </>
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
