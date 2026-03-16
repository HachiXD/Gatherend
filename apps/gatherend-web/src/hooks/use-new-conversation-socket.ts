import { useSocketClient } from "@/components/providers/socket-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

interface Conversation {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  profileOne: ClientProfileSummary & {
    userId: string;
  };
  profileTwo: ClientProfileSummary & {
    userId: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface NewConversationEvent {
  conversation: Conversation;
  otherProfile: Conversation["profileOne"];
}

interface UseNewConversationSocketProps {
  profileId: string;
  onNewConversation?: (data: NewConversationEvent) => void;
}

export const useNewConversationSocket = ({
  profileId,
  onNewConversation,
}: UseNewConversationSocketProps) => {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `user:${profileId}:new-conversation`;

    const handleNewConversation = (data: NewConversationEvent) => {

      // Invalidar queries relacionadas con conversaciones
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      // Callback personalizado si se proporciona
      if (onNewConversation) {
        onNewConversation(data);
      }
    };

    socket.on(eventKey, handleNewConversation);

    return () => {
      socket.off(eventKey, handleNewConversation);
    };
  }, [socket, profileId, queryClient, onNewConversation]);
};

