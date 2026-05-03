import { expressFetch } from "@/src/services/express/express-fetch";
import type { ProfileCardConfig } from "@/src/features/profile/lib/card/profile-card-config";
import type { ClientPublicAsset, ClientStickerAssetRef } from "@/src/features/chat/types";

export type ProfileCard = {
  id: string;
  username: string;
  discriminator: string | null;
  avatarAsset: ClientPublicAsset | null;
  bannerAsset: ClientPublicAsset | null;
  usernameColor: unknown;
  badge: string | null;
  badgeSticker: ClientStickerAssetRef | null;
  usernameFormat: unknown;
  profileTags: string[];
  profileCardConfig: ProfileCardConfig | null;
  profileCardLeftTopImageAsset: ClientPublicAsset | null;
  profileCardLeftBottomRightTopImageAsset: ClientPublicAsset | null;
  profileCardLeftBottomRightBottomImageAsset: ClientPublicAsset | null;
  profileCardRightTopImageAsset: ClientPublicAsset | null;
  profileCardRightBottomImageAsset: ClientPublicAsset | null;
};

export async function getProfileCard(
  profileId: string,
  currentProfileId: string,
): Promise<ProfileCard> {
  const response = await expressFetch(`/profiles/${profileId}/card`, {
    profileId: currentProfileId,
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el perfil");
  }

  return (await response.json()) as ProfileCard;
}
