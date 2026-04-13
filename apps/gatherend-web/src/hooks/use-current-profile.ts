"use client";

import { useQuery } from "@tanstack/react-query";
import { Languages } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { useTokenReady } from "@/components/providers/token-manager-provider";
import { useSession } from "@/lib/better-auth-client";
import type { ChatBubbleStyle } from "@/lib/chat-bubble-style";
import type { ProfileCardConfig } from "@/lib/profile-card-config";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

export interface ClientProfile {
  id: string;
  username: string;
  discriminator: string;
  avatarAssetId: string | null;
  bannerAssetId: string | null;
  badgeStickerId: string | null;
  profileCardConfig: ProfileCardConfig | null;
  profileCardLeftTopImageAssetId: string | null;
  profileCardLeftBottomRightTopImageAssetId: string | null;
  profileCardLeftBottomRightBottomImageAssetId: string | null;
  profileCardRightTopImageAssetId: string | null;
  profileCardRightBottomImageAssetId: string | null;
  avatarAsset: ClientUploadedAsset | null;
  bannerAsset: ClientUploadedAsset | null;
  profileCardLeftTopImageAsset: ClientUploadedAsset | null;
  profileCardLeftBottomRightTopImageAsset: ClientUploadedAsset | null;
  profileCardLeftBottomRightBottomImageAsset: ClientUploadedAsset | null;
  profileCardRightTopImageAsset: ClientUploadedAsset | null;
  profileCardRightBottomImageAsset: ClientUploadedAsset | null;
  badgeSticker: ClientStickerAssetRef | null;
  email: string;
  languages: Languages[];
  usernameColor: JsonValue;
  profileTags: string[];
  badge: string | null;
  usernameFormat: JsonValue;
  themeConfig: JsonValue;
  chatBubbleStyle: ChatBubbleStyle | null;
}

export function useCurrentProfile() {
  const { data: session, isPending } = useSession();
  const tokenReady = useTokenReady();
  const isSignedIn = Boolean(session?.user?.id);
  const isLoaded = !isPending;

  return useQuery<ClientProfile>({
    queryKey: ["current-profile"],
    queryFn: async () => {
      if (!isLoaded || !tokenReady) {
        throw new Error("Auth not loaded");
      }

      if (!isSignedIn) {
        throw new Error("Not signed in");
      }

      const response = await fetchWithRetry("/api/profile/me");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch profile");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: isLoaded && isSignedIn && tokenReady,
  });
}
