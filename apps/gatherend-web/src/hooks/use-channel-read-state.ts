import { useEffect, useCallback, useRef, useMemo } from "react";
import { useUnreadStore } from "./use-unread-store";
import { useMentionStore } from "./use-mention-store";
import { useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

export function useChannelReadState(
  profileId: string | undefined,
  boardIds: string[],
) {
  const {
    initializeChannelStateFromServer,
    replaceChannelStateFromServer,
    initializeDmFromServer,
    replaceDmFromServer,
    clearUnread,
    clearDmUnread,
    setViewingRoom,
    setLastAck,
  } = useUnreadStore();
  const {
    initializeFromServer: initializeMentions,
    replaceFromServer: replaceMentionsFromServer,
    clearMention,
  } = useMentionStore();
  const reconnectVersion = useSocketRecoveryVersion();
  const conversationsLoadedRef = useRef(false);
  const conversationUnreadSnapshotRef = useRef<Record<string, number>>({});

  const stableBoardIds = useMemo(() => boardIds.join(","), [boardIds]);

  useEffect(() => {
    if (!profileId || !stableBoardIds) return;

    const loadSidebarState = async () => {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

      try {
        const authHeaders = getExpressAuthHeaders(profileId);

        const res = await fetch(`${socketUrl}/channel-read-state/sidebar`, {
          credentials: "include",
          headers: authHeaders,
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          channels?: Array<{
            channelId: string;
            unreadCount: number;
            lastReadSeq: number;
            hasUnreadMention: boolean;
          }>;
        };

        const channels = Array.isArray(data.channels) ? data.channels : [];
        const mentionChannelIds = channels
          .filter((channel) => channel.hasUnreadMention)
          .map((channel) => channel.channelId);

        if (reconnectVersion > 0) {
          replaceChannelStateFromServer(channels);
          replaceMentionsFromServer(mentionChannelIds);
        } else {
          initializeChannelStateFromServer(channels);
          initializeMentions(mentionChannelIds);
        }
      } catch (error) {
        console.error("[channel-read-state] Error loading sidebar state:", error);
      }
    };

    loadSidebarState();
  }, [
    profileId,
    stableBoardIds,
    reconnectVersion,
    initializeChannelStateFromServer,
    initializeMentions,
    replaceChannelStateFromServer,
    replaceMentionsFromServer,
  ]);

  useEffect(() => {
    if (!profileId) return;
    if (reconnectVersion === 0 && conversationsLoadedRef.current) return;

    const loadConversationUnreads = async () => {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

      try {
        const authHeaders = getExpressAuthHeaders(profileId);

        const res = await fetch(
          `${socketUrl}/conversation-read-state/unreads`,
          {
            credentials: "include",
            headers: authHeaders,
          },
        );

        if (res.ok) {
          const unreadCounts = await res.json();
          if (reconnectVersion > 0) {
            conversationUnreadSnapshotRef.current = unreadCounts;
            replaceDmFromServer(unreadCounts);
          } else if (Object.keys(unreadCounts).length > 0) {
            conversationUnreadSnapshotRef.current = {
              ...conversationUnreadSnapshotRef.current,
              ...unreadCounts,
            };
            initializeDmFromServer(unreadCounts);
          }
          conversationsLoadedRef.current = true;
        }
      } catch (error) {
        console.error(
          "[channel-read-state] Error loading conversation unreads:",
          error,
        );
      }
    };

    loadConversationUnreads();
  }, [
    profileId,
    reconnectVersion,
    initializeDmFromServer,
    replaceDmFromServer,
  ]);

  const markAsRead = useCallback(
    async (roomId: string, isConversation = false) => {
      if (!profileId) return;

      setViewingRoom(roomId);

      if (isConversation) {
        clearDmUnread(roomId);
        setLastAck(roomId);
      } else {
        const unreadState = useUnreadStore.getState();
        const estimatedLatestSeq =
          (unreadState.lastAck[roomId] || 0) + (unreadState.unreads[roomId] || 0);
        clearUnread(roomId);
        setLastAck(roomId, estimatedLatestSeq);
      }

      clearMention(roomId);

      try {
        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

        const authHeaders = getExpressAuthHeaders(profileId);

        const endpoint = isConversation
          ? `${socketUrl}/conversation-read-state/${roomId}/read`
          : `${socketUrl}/channel-read-state/${roomId}/read`;

        await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
        });
      } catch (error) {
        console.error("[channel-read-state] Error marking as read:", error);
      }
    },
    [
      profileId,
      clearUnread,
      clearDmUnread,
      clearMention,
      setViewingRoom,
      setLastAck,
    ],
  );

  const clearViewingRoom = useCallback(() => {
    setViewingRoom(null);
  }, [setViewingRoom]);

  return { markAsRead, clearViewingRoom };
}
