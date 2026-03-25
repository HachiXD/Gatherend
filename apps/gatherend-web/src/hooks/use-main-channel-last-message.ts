import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";
import type {
  ClientAttachmentAsset,
} from "@/types/uploaded-assets";
import type { ChannelMessage } from "@/hooks/chat/types";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface LastMessageData extends ChannelMessage {
  hasAttachment?: boolean;
  attachmentAsset: ClientAttachmentAsset | null;
}

interface UseMainChannelLastMessageProps {
  channelId: string;
  boardId: string;
  profileId: string;
  enabled?: boolean;
}

/**
 * Hook para obtener el último mensaje de un canal (usado para preview en MAIN channel)
 */
export const useMainChannelLastMessage = ({
  channelId,
  boardId,
  profileId,
  enabled = true,
}: UseMainChannelLastMessageProps) => {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  const queryKey = useMemo(
    () => ["channel-last-message", channelId],
    [channelId],
  );

  const { data: lastMessage, isLoading } = useQuery<LastMessageData | null>({
    queryKey,
    queryFn: async () => {
      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;
      if (!boardId) return null;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/messages?channelId=${channelId}&boardId=${boardId}&limit=1`,
        {
          credentials: "include",
          headers: getExpressAuthHeaders(profileId, token),
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.items?.[0] || null;
    },
    enabled: enabled && !!channelId && !!boardId && !!profileId,
    staleTime: 1000 * 60, // 1 minuto
    refetchOnWindowFocus: false,
  });

  // Escuchar nuevos mensajes via socket para actualizar el preview
  useEffect(() => {
    if (!socket || !channelId || !enabled) return;

    const handleNewMessage = (
      message: LastMessageData & { channelId?: string },
    ) => {
      if (message.channelId === channelId) {
        queryClient.setQueryData(queryKey, message);
      }
    };

    const handleMessageUpdate = (
      message: LastMessageData & { channelId?: string },
    ) => {
      if (message.channelId === channelId) {
        queryClient.setQueryData<LastMessageData | null>(queryKey, (old) => {
          if (old?.id === message.id) {
            return message;
          }
          return old;
        });
      }
    };

    socket.on(`chat:${channelId}:messages`, handleNewMessage);
    socket.on(`chat:${channelId}:messages:update`, handleMessageUpdate);

    return () => {
      socket.off(`chat:${channelId}:messages`, handleNewMessage);
      socket.off(`chat:${channelId}:messages:update`, handleMessageUpdate);
    };
  }, [socket, channelId, enabled, queryClient, queryKey]);

  return {
    lastMessage,
    isLoading,
  };
};


