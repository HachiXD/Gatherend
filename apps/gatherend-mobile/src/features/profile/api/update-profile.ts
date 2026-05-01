import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";

export type ProfileUpdatePayload = {
  username?: string;
  avatarAssetId?: string | null;
  bannerAssetId?: string | null;
  languages?: string[];
  chatBubbleStyle?: unknown;
  usernameColor?: unknown;
  profileTags?: string[];
  badge?: string | null;
  badgeStickerId?: string | null;
  usernameFormat?: unknown;
  profileCardConfig?: unknown;
  profileCardLeftTopImageAssetId?: string | null;
  profileCardLeftBottomRightTopImageAssetId?: string | null;
  profileCardLeftBottomRightBottomImageAssetId?: string | null;
  profileCardRightTopImageAssetId?: string | null;
  profileCardRightBottomImageAssetId?: string | null;
};

export async function updateProfile(
  payload: ProfileUpdatePayload,
): Promise<ClientProfile> {
  const response = await nextApiFetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readNextApiError(response, "Failed to update profile");
    throw new Error(message);
  }

  return response.json() as Promise<ClientProfile>;
}
