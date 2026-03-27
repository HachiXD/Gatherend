"use client";

import { useEffect } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useMentionStore } from "./use-mention-store";
import { useUnreadStore } from "./use-unread-store";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

interface MentionNotification {
  messageId: string;
  channelId: string;
  boardId: string;
  sender: ClientProfileSummary;
  content: string;
}

interface UseMentionNotificationsProps {
  profileId: string;
  onMention?: (notification: MentionNotification) => void;
}

export const useMentionNotifications = ({
  profileId,
  onMention,
}: UseMentionNotificationsProps) => {
  const { socket } = useSocketClient();
  const { addMention } = useMentionStore();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `mention:${profileId}`;

    const handleMention = (notification: MentionNotification) => {
      // Don't count the mention if the user is already viewing that channel
      const viewingRoom = useUnreadStore.getState().viewingRoom;
      if (viewingRoom === notification.channelId) return;

      addMention(notification.channelId);

      if (Notification.permission === "granted") {
        new Notification(`${notification.sender.username} mentioned you`, {
          body: notification.content,
          icon: notification.sender.avatarAsset?.url || "/default-avatar.png",
        });
      }

      onMention?.(notification);
    };

    socket.on(eventKey, handleMention);

    return () => {
      socket.off(eventKey, handleMention);
    };
  }, [socket, profileId, onMention, addMention]);
};

