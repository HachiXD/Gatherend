"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { VoiceParticipantsView } from "@/components/voice-participants-view";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useAutoMarkAsRead } from "@/hooks/use-auto-mark-as-read";
import { useConversations } from "@/hooks/use-conversations";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { useProfileRoomSubscriptions } from "@/hooks/use-profile-room-subscriptions";
import type { FormattedConversation } from "@/hooks/use-conversations";

// Tipo para el fetch individual (retorna profileOne y profileTwo completos)
interface ConversationWithProfiles {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  profileOne: FormattedConversation["profileOne"];
  profileTwo: FormattedConversation["profileTwo"];
}

interface ConversationViewProps {
  /** ID de la conversacion (desde CenterContentRouter via BoardSwitchContext) */
  conversationId: string;
  /** ID del board (desde CenterContentRouter via BoardSwitchContext) */
  boardId: string;
}

/**
 * ConversationView - Vista de conversacion directa (DM)
 *
 * El lifecycle realtime del room vive en ChatMessages/useMountedChatRoom.
 * Esta vista solo resuelve datos y renderiza la composicion del chat.
 */
export function ConversationView({
  conversationId,
  boardId,
}: ConversationViewProps) {
  const profile = useProfile();

  // Auto-marcar conversacion como leida cuando el usuario entra
  useAutoMarkAsRead(conversationId, true);

  // ESTRATEGIA HIBRIDA: Cache del rightbar + Fetch autonomo

  // 1. Intentar obtener del cache de lista (si rightbar ya lo cargo)
  const { conversations, isFetched: conversationsFetched } = useConversations();
  const cachedConversation = useMemo(() => {
    return conversations.find((c) => c.id === conversationId);
  }, [conversationId, conversations]);

  // OPTIMIZACION: Solo hacer fetch individual si:
  // 1. La lista de conversaciones ya se cargo (evita race condition)
  // 2. La conversacion NO esta en el cache
  const shouldFetchIndividual = conversationsFetched && !cachedConversation;

  // 2. Fetch autonomo (solo para deep links cuando no esta en cache)
  const { data: fetchedConversation } = useQuery<ConversationWithProfiles>({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },
    enabled: shouldFetchIndividual,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // 3. Usar cache si esta disponible, sino el fetch individual
  const conversation = cachedConversation || fetchedConversation;

  // Calcular otherProfile (del cache viene pre-calculado, del fetch hay que calcularlo)
  const otherProfile = useMemo(() => {
    if (!conversation || !profile.id) return undefined;

    // Si viene del cache de useConversations, ya tiene otherProfile
    if ("otherProfile" in conversation) {
      return conversation.otherProfile;
    }

    // Si viene del fetch individual, calcular quien es el otro
    const isProfileOne = conversation.profileOneId === profile.id;
    return isProfileOne ? conversation.profileTwo : conversation.profileOne;
  }, [conversation, profile.id]);

  // Voice store - solo para verificar si estamos en llamada de esta conversacion
  const {
    isConnected,
    isConnecting,
    channelId: activeVoiceChannel,
    context,
  } = useVoiceStore();

  // Check if we're in a call for THIS conversation (conectando O conectado)
  const isInThisCall =
    (isConnected || isConnecting) &&
    activeVoiceChannel === conversation?.id &&
    context === "conversation";

  // Safety net: ensure realtime profile updates for the active DM participant
  useProfileRoomSubscriptions(otherProfile ? [otherProfile.id] : []);

  if (!conversation || !otherProfile) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        avatarUrl={otherProfile.avatarAsset?.url || undefined}
        name={otherProfile.username}
        boardId={boardId}
        type="conversation"
        profileId={otherProfile.id}
        conversationId={conversation.id}
      />

      {isInThisCall && (
        <div className="h-1/2 min-h-[200px] border-b border-theme-border-primary">
          <VoiceParticipantsView chatId={conversation.id} />
        </div>
      )}

      <ChatMessages
        name={otherProfile.username}
        currentProfile={profile}
        currentMember={null}
        type="conversation"
        apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/direct-messages`}
        paramKey="conversationId"
        paramValue={conversation.id}
        socketQuery={{
          conversationId: conversation.id,
        }}
      />
      <ChatInput
        name={otherProfile.username}
        type="conversation"
        apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/direct-messages`}
        currentProfile={profile}
        query={{
          conversationId: conversation.id,
        }}
        chatQueryKey={["chat", "conversation", conversation.id]}
        roomId={conversation.id}
      />
    </div>
  );
}
