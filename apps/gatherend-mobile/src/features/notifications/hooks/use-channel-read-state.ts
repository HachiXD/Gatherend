import { useEffect, useCallback, useRef, useMemo } from "react";
import {
  useUnreadStore,
  addPendingRead,
  removePendingRead,
} from "../stores/use-unread-store";
import { useMentionStore } from "../stores/use-mention-store";
import { useSocketRecoveryVersion } from "@/src/providers/socket-context";
import { expressFetch } from "@/src/services/express/express-fetch";

export function useChannelReadState(profileId: string | undefined) {
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

  // Load channel unread + mention state from server.
  // Re-runs on reconnect (reconnectVersion increments).
  useEffect(() => {
    if (!profileId) return;

    const loadSidebarState = async () => {
      try {
        const res = await expressFetch("/channel-read-state/sidebar", {
          profileId,
        });
        if (!res.ok) return;

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
          .filter((c) => c.hasUnreadMention)
          .map((c) => c.channelId);

        if (reconnectVersion > 0) {
          replaceChannelStateFromServer(channels);
          replaceMentionsFromServer(mentionChannelIds);
        } else {
          initializeChannelStateFromServer(channels);
          initializeMentions(mentionChannelIds);
        }
      } catch (error) {
        console.error("[read-state] Error loading sidebar state:", error);
      }
    };

    loadSidebarState();
  }, [
    profileId,
    reconnectVersion,
    initializeChannelStateFromServer,
    replaceChannelStateFromServer,
    initializeMentions,
    replaceMentionsFromServer,
  ]);

  // Load DM unread counts from server.
  // Only re-fetches on reconnect after the first load.
  useEffect(() => {
    if (!profileId) return;
    if (reconnectVersion === 0 && conversationsLoadedRef.current) return;

    const loadConversationUnreads = async () => {
      try {
        const res = await expressFetch("/conversation-read-state/unreads", {
          profileId,
        });
        if (!res.ok) return;

        const unreadCounts: Record<string, number> = await res.json();

        if (reconnectVersion > 0) {
          replaceDmFromServer(unreadCounts);
        } else if (Object.keys(unreadCounts).length > 0) {
          initializeDmFromServer(unreadCounts);
        }
        conversationsLoadedRef.current = true;
      } catch (error) {
        console.error(
          "[read-state] Error loading conversation unreads:",
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

  /**
   * Mark a room as read — clears local state immediately and notifies the server.
   * Call when the user navigates into a channel or DM.
   */
  const markAsRead = useCallback(
    async (roomId: string, isConversation = false) => {
      if (!profileId) return;

      setViewingRoom(roomId);
      addPendingRead(roomId);

      if (isConversation) {
        clearDmUnread(roomId);
        setLastAck(roomId);
      } else {
        const unreadState = useUnreadStore.getState();
        const estimatedLatestSeq =
          (unreadState.lastAck[roomId] || 0) +
          (unreadState.unreads[roomId] || 0);
        clearUnread(roomId);
        setLastAck(roomId, estimatedLatestSeq);
      }

      clearMention(roomId);

      try {
        const endpoint = isConversation
          ? `/conversation-read-state/${roomId}/read`
          : `/channel-read-state/${roomId}/read`;

        await expressFetch(endpoint, { method: "POST", profileId });
      } catch (error) {
        console.error("[read-state] Error marking as read:", error);
      } finally {
        removePendingRead(roomId);
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
