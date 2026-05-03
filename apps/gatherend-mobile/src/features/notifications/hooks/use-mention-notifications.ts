import { useEffect } from "react";
import { useSocketClient } from "@/src/providers/socket-context";
import { useMentionStore } from "../stores/use-mention-store";
import { useUnreadStore } from "../stores/use-unread-store";

interface MentionNotification {
  messageId: string;
  channelId: string;
  boardId: string;
  sender: { id: string; username: string; avatarAsset?: { url: string } | null };
  content: string;
}

export function useMentionNotifications(profileId: string | undefined) {
  const { socket } = useSocketClient();
  const { addMention } = useMentionStore();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `mention:${profileId}`;

    const handleMention = (notification: MentionNotification) => {
      const viewingRoom = useUnreadStore.getState().viewingRoom;
      if (viewingRoom === notification.channelId) return;

      addMention(notification.channelId);
    };

    socket.on(eventKey, handleMention);
    return () => {
      socket.off(eventKey, handleMention);
    };
  }, [socket, profileId, addMention]);
}
