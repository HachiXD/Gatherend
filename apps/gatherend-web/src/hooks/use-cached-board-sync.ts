"use client";

import { useSocketClient, useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { acquireBoardRoom, releaseBoardRoom, rejoinBoardRooms } from "@/hooks/board-room-subscriptions";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";
import type { BoardWithData, BoardChannel, BoardMember } from "@/components/providers/board-provider";
import { useEffect, useRef } from "react";

interface MemberJoinedPayload {
  boardId: string;
  member: {
    id: string;
    role: string;
    profileId: string;
    boardId: string;
    createdAt: string;
    updatedAt: string;
    profile: {
      id: string;
      username: string;
      discriminator: string | null;
      avatarAsset: ClientUploadedAsset | null;
      usernameColor: unknown;
      profileTags: string[];
      badge: string | null;
      badgeSticker: { id: string; asset: ClientUploadedAsset | null } | null;
      usernameFormat: unknown;
    };
  };
  timestamp: number;
}

interface MemberLeftPayload {
  boardId: string;
  profileId: string;
  timestamp: number;
}

interface MemberRoleChangedPayload {
  boardId: string;
  profileId: string;
  role: string;
  timestamp: number;
}

interface ChannelCreatedPayload {
  boardId: string;
  channel: Omit<BoardChannel, "isJoined" | "createdAt" | "updatedAt"> & {
    createdAt: string;
    updatedAt: string;
  };
  autoJoinedProfileIds: string[];
  timestamp: number;
}

interface ChannelDeletedPayload {
  boardId: string;
  channelId: string;
  timestamp: number;
}

interface ChannelUpdatedPayload {
  boardId: string;
  channel: {
    id: string;
    name?: string;
    type?: string;
    imageAsset?: ClientUploadedAsset | null;
    updatedAt?: string;
  };
  timestamp: number;
}

interface ChannelMembershipChangedPayload {
  boardId: string;
  channelId: string;
  profileId: string;
  action: "joined";
  channelMemberCount: number;
  timestamp: number;
}

function getCachedBoardIds(queryClient: ReturnType<typeof useQueryClient>): Set<string> {
  const cachedBoardIds = new Set<string>();

  queryClient
    .getQueryCache()
    .getAll()
    .forEach((query) => {
      const { queryKey } = query;
      if (
        Array.isArray(queryKey) &&
        queryKey.length === 2 &&
        queryKey[0] === "board" &&
        typeof queryKey[1] === "string"
      ) {
        cachedBoardIds.add(queryKey[1]);
      }
    });

  return cachedBoardIds;
}

export function useCachedBoardSync(currentProfileId?: string): void {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();
  const observedBoardIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    const syncObservedRooms = () => {
      const cachedBoardIds = getCachedBoardIds(queryClient);
      const observedBoardIds = observedBoardIdsRef.current;

      observedBoardIds.forEach((boardId) => {
        if (!cachedBoardIds.has(boardId)) {
          releaseBoardRoom(socket, boardId);
          observedBoardIds.delete(boardId);
        }
      });

      cachedBoardIds.forEach((boardId) => {
        if (!observedBoardIds.has(boardId)) {
          acquireBoardRoom(socket, boardId);
          observedBoardIds.add(boardId);
        }
      });
    };

    const handleMemberJoined = (payload: MemberJoinedPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        if (old.members.some((m) => m.profileId === payload.member.profileId)) return old;
        const newMember = {
          ...payload.member,
          activeWarningCount: 0,
          latestActiveWarningId: null,
          role: payload.member.role as BoardMember["role"],
          createdAt: new Date(payload.member.createdAt),
          updatedAt: new Date(payload.member.updatedAt),
        } as BoardMember;
        return { ...old, members: [...old.members, newMember] };
      });
    };

    const handleMemberLeft = (payload: MemberLeftPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        return { ...old, members: old.members.filter((m) => m.profileId !== payload.profileId) };
      });
    };

    const handleMemberRoleChanged = (payload: MemberRoleChangedPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.profileId === payload.profileId
              ? { ...m, role: payload.role as BoardMember["role"] }
              : m,
          ),
        };
      });
    };

    const handleChannelCreated = (payload: ChannelCreatedPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        // Deduplicate: the creator already has the channel via the modal's optimistic update
        if (old.channels.some((ch) => ch.id === payload.channel.id)) return old;
        const newChannel: BoardChannel = {
          ...payload.channel,
          isJoined:
            currentProfileId !== undefined &&
            payload.autoJoinedProfileIds.includes(currentProfileId),
          createdAt: new Date(payload.channel.createdAt),
          updatedAt: new Date(payload.channel.updatedAt),
        };
        return { ...old, channels: [...old.channels, newChannel] };
      });
    };

    const handleChannelDeleted = (payload: ChannelDeletedPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        return { ...old, channels: old.channels.filter((ch) => ch.id !== payload.channelId) };
      });
    };

    const handleChannelUpdated = (payload: ChannelUpdatedPayload) => {
      queryClient.setQueryData<BoardWithData>(["board", payload.boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          channels: old.channels.map((ch) =>
            ch.id === payload.channel.id
              ? {
                  ...ch,
                  ...(payload.channel.name !== undefined && { name: payload.channel.name }),
                  ...(payload.channel.type !== undefined && { type: payload.channel.type as BoardChannel["type"] }),
                  ...(payload.channel.imageAsset !== undefined && {
                    imageAsset: payload.channel.imageAsset,
                  }),
                  ...(payload.channel.updatedAt !== undefined && { updatedAt: new Date(payload.channel.updatedAt) }),
                }
              : ch,
          ),
        };
      });
    };

    const handleChannelMembershipChanged = (
      payload: ChannelMembershipChangedPayload,
    ) => {
      queryClient.setQueryData<BoardWithData>(
        ["board", payload.boardId],
        (old) => {
          if (!old) return old;

          let changed = false;

          const nextChannels = old.channels.map((channel) => {
            if (channel.id !== payload.channelId) {
              return channel;
            }

            const nextIsJoined =
              payload.action === "joined" &&
              currentProfileId !== undefined &&
              payload.profileId === currentProfileId
                ? true
                : channel.isJoined;

            if (
              channel.channelMemberCount === payload.channelMemberCount &&
              channel.isJoined === nextIsJoined
            ) {
              return channel;
            }

            changed = true;
            return {
              ...channel,
              channelMemberCount: payload.channelMemberCount,
              isJoined: nextIsJoined,
            };
          });

          if (!changed) return old;

          return {
            ...old,
            channels: nextChannels,
          };
        },
      );
    };

    const handleConnect = () => {
      rejoinBoardRooms(socket);
      syncObservedRooms();
    };

    const unsubscribeQueryCache = queryClient
      .getQueryCache()
      .subscribe(() => {
        syncObservedRooms();
      });

    syncObservedRooms();

    socket.on("connect", handleConnect);
    socket.on("board:member-joined", handleMemberJoined);
    socket.on("board:member-left", handleMemberLeft);
    socket.on("board:member-role-changed", handleMemberRoleChanged);
    socket.on("board:channel-created", handleChannelCreated);
    socket.on("board:channel-deleted", handleChannelDeleted);
    socket.on("board:channel-updated", handleChannelUpdated);
    socket.on(
      "board:channel-membership-changed",
      handleChannelMembershipChanged,
    );

    return () => {
      unsubscribeQueryCache();
      socket.off("connect", handleConnect);
      socket.off("board:member-joined", handleMemberJoined);
      socket.off("board:member-left", handleMemberLeft);
      socket.off("board:member-role-changed", handleMemberRoleChanged);
      socket.off("board:channel-created", handleChannelCreated);
      socket.off("board:channel-deleted", handleChannelDeleted);
      socket.off("board:channel-updated", handleChannelUpdated);
      socket.off(
        "board:channel-membership-changed",
        handleChannelMembershipChanged,
      );

      observedBoardIdsRef.current.forEach((boardId) => {
        releaseBoardRoom(socket, boardId);
      });
      observedBoardIdsRef.current.clear();
    };
  }, [socket, queryClient, currentProfileId]);

  useEffect(() => {
    if (reconnectVersion === 0) return;

    getCachedBoardIds(queryClient).forEach((boardId) => {
      void queryClient.refetchQueries({
        queryKey: ["board", boardId],
        exact: true,
        type: "all",
      });
    });
  }, [queryClient, reconnectVersion]);
}
