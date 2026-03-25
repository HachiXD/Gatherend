"use client";

import { useSocketClient, useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  requester: ClientProfileSummary;
  receiver: ClientProfileSummary;
  createdAt: string;
}

interface FriendRequestEvent {
  type: "new" | "accepted" | "rejected";
  friendship: Friendship;
}

interface UseFriendRequestSocketProps {
  profileId: string;
  onNewRequest?: (data: FriendRequestEvent) => void;
}

export const useFriendRequestSocket = ({
  profileId,
  onNewRequest,
}: UseFriendRequestSocketProps) => {
  const { socket } = useSocketClient();
  const reconnectVersion = useSocketRecoveryVersion();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `user:${profileId}:friend-request`;

    const handleFriendRequest = (data: FriendRequestEvent) => {

      // Invalidar queries relacionadas con friend requests
      queryClient.invalidateQueries({
        queryKey: ["friendRequests", "pending"],
      });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      // Callback personalizado si se proporciona
      if (onNewRequest) {
        onNewRequest(data);
      }
    };

    socket.on(eventKey, handleFriendRequest);

    return () => {
      socket.off(eventKey, handleFriendRequest);
    };
  }, [socket, profileId, queryClient, onNewRequest]);

  useEffect(() => {
    if (reconnectVersion === 0) return;

    if (queryClient.getQueryState(["friendRequests", "pending"])) {
      void queryClient.refetchQueries({
        queryKey: ["friendRequests", "pending"],
        exact: true,
        type: "all",
      });
    }

    if (queryClient.getQueryState(["friends"])) {
      void queryClient.refetchQueries({
        queryKey: ["friends"],
        exact: true,
        type: "all",
      });
    }
  }, [queryClient, reconnectVersion]);
};

