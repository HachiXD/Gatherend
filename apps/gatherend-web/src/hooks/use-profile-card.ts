"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { UsernameFormatConfig } from "@/lib/username-format";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

// Tipo para los datos del ProfileCard
export interface ProfileCard {
  id: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientUploadedAsset | null;
  usernameColor: unknown; // JSON field
  badge: string | null;
  badgeSticker: ClientStickerAssetRef | null;
  usernameFormat: UsernameFormatConfig | string | null; // Supports both legacy and new format
  longDescription: string | null;
}

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

/**
 * Hook para obtener los datos completos de un perfil para el UserAvatarMenu
 *
 * Estrategia de cache:
 * - staleTime: 5 segundos - evita spam de requests al abrir/cerrar rápido
 * - gcTime: 30 segundos - mantiene en memoria por si se vuelve a abrir
 * - refetchOnWindowFocus: false - no refetch automático al cambiar de pestaña
 *
 * La invalidación se hace manualmente cuando el usuario edita su propio perfil
 */
export const useProfileCard = (
  profileId: string,
  currentProfileId: string,
  enabled: boolean = false
) => {
  const getToken = useTokenGetter();

  return useQuery<ProfileCard>({
    queryKey: ["profile-card", profileId],
    queryFn: async () => {
      const token = await getToken();
      const response = await axios.get(
        `${SOCKET_URL}/profiles/${profileId}/card`,
        getExpressAxiosConfig(currentProfileId, token),
      );
      return response.data;
    },
    enabled: enabled && !!profileId && !!currentProfileId,
    staleTime: 5 * 1000, // 5 segundos - datos "frescos" por este tiempo
    gcTime: 30 * 1000, // 30 segundos en cache antes de garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Siempre refetch cuando se monta (si stale)
    retry: 1, // Solo 1 retry en caso de error
  });
};

/**
 * Hook para invalidar el cache del ProfileCard
 * Usar cuando el usuario edita su propio perfil
 */
export const useInvalidateProfileCard = () => {
  const queryClient = useQueryClient();

  const invalidateProfileCard = (profileId: string) => {
    queryClient.invalidateQueries({ queryKey: ["profile-card", profileId] });
  };

  const invalidateAllProfileCards = () => {
    queryClient.invalidateQueries({ queryKey: ["profile-card"] });
  };

  return { invalidateProfileCard, invalidateAllProfileCards };
};

