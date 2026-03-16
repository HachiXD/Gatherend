"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { VoiceParticipantsView } from "@/components/voice-participants-view";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useAutoMarkAsRead } from "@/hooks/use-auto-mark-as-read";
import { useConversations } from "@/hooks/use-conversations";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { useProfileRoomSubscriptions } from "@/hooks/use-profile-room-subscriptions";
import { useConversationSubscriptionStore } from "@/hooks/use-conversation-subscription-store";
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
  /** ID de la conversación (desde CenterContentRouter via BoardSwitchContext) */
  conversationId: string;
  /** ID del board (desde CenterContentRouter via BoardSwitchContext) */
  boardId: string;
}

/**
 * ConversationView - Vista de conversación directa (DM)
 *
 * Componente cliente que renderiza el chat de un DM.
 * Obtiene datos via React Query.
 *
 * OPTIMIZACIÓN: Ya no usa useParams() — las props siempre vienen del
 * BoardSwitchContext (inicializado por el layout para deep links,
 * o actualizado por switchConversation para navegación SPA).
 */
export function ConversationView({
  conversationId,
  boardId,
}: ConversationViewProps) {
  const profile = useProfile();
  const queryClient = useQueryClient();
  const subscribeConversation = useConversationSubscriptionStore(
    (s) => s.subscribe,
  );

  // Auto-marcar conversación como leída cuando el usuario entra
  useAutoMarkAsRead(conversationId, true);

  // DM heavy stream lifecycle:
  // - Touch/create ["chat","conversation",id] so gcTime governs leave-conversation
  // - Enforce LRU max (10) via removeQueries on overflow keys
  useEffect(() => {
    if (!conversationId) return;

    const { overflow } = subscribeConversation(conversationId);

    queryClient.setQueryData(["chat", "conversation", conversationId], (prev) => {
      const base =
        prev && typeof prev === "object"
          ? (prev as Record<string, unknown>)
          : {};
      return { ...base, __lifecycle: true, touchedAt: Date.now() };
    });

    Array.from(new Set(overflow)).forEach((id) => {
      queryClient.removeQueries({
        queryKey: ["chat", "conversation", id],
        exact: true,
      });
    });
  }, [conversationId, queryClient, subscribeConversation]);

  // ESTRATEGIA HÍBRIDA: Cache del rightbar + Fetch autónomo

  // 1. Intentar obtener del cache de lista (si rightbar ya lo cargó)
  const { conversations, isFetched: conversationsFetched } = useConversations();
  const cachedConversation = useMemo(() => {
    return conversations.find((c) => c.id === conversationId);
  }, [conversationId, conversations]);

  // OPTIMIZACIÓN: Solo hacer fetch individual si:
  // 1. La lista de conversaciones ya se cargó (evita race condition)
  // 2. La conversación NO está en el cache
  // Esto previene double fetching cuando conversations está vacío inicialmente
  const shouldFetchIndividual = conversationsFetched && !cachedConversation;

  // 2. Fetch autónomo (solo para deep links cuando no está en cache)
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

  // 3. Usar cache si está disponible, sino el fetch individual
  const conversation = cachedConversation || fetchedConversation;

  // Calcular otherProfile (del cache viene pre-calculado, del fetch hay que calcularlo)
  const otherProfile = useMemo(() => {
    if (!conversation || !profile.id) return undefined;

    // Si viene del cache de useConversations, ya tiene otherProfile
    if ("otherProfile" in conversation) {
      return conversation.otherProfile;
    }

    // Si viene del fetch individual, calcular quién es el otro
    const isProfileOne = conversation.profileOneId === profile.id;
    return isProfileOne ? conversation.profileTwo : conversation.profileOne;
  }, [conversation, profile.id]);

  // Voice store - solo para verificar si estamos en llamada de esta conversación
  const {
    isConnected,
    isConnecting,
    channelId: activeVoiceChannel,
    context,
  } = useVoiceStore();

  // Check if we're in a call for THIS conversation (conectando O conectado)
  // Necesitamos renderizar VoiceParticipantsView para que LiveKit pueda conectar
  const isInThisCall =
    (isConnected || isConnecting) &&
    activeVoiceChannel === conversation?.id &&
    context === "conversation";

  // Si no hay conversación ni del cache ni del fetch, retornar null
  // Safety net: ensure realtime profile updates for the active DM participant
  useProfileRoomSubscriptions(otherProfile ? [otherProfile.id] : []);

  if (!conversation || !otherProfile) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header fijo - igual que en ChannelView */}
      <ChatHeader
        avatarUrl={otherProfile.avatarAsset?.url || undefined}
        name={otherProfile.username}
        boardId={boardId}
        type="conversation"
        profileId={otherProfile.id}
        conversationId={conversation.id}
      />

      {/* Voice participants view when in call */}
      {isInThisCall && (
        <div className="h-1/2 min-h-[200px] border-b border-theme-border-primary">
          <VoiceParticipantsView chatId={conversation.id} />
        </div>
      )}

      {/* Contenedor de mensajes + input que ocupa el espacio restante */}
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
