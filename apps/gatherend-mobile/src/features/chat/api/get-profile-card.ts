import { expressFetch } from "@/src/services/express/express-fetch";
import type { ClientPublicAsset, ClientStickerAssetRef } from "../types";

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
