import { db } from "../../lib/db.js";
import {
  profileSelect,
  serializeProfile,
  serializeUploadedAsset,
  uploadedAssetSelect,
} from "../../lib/uploaded-assets.js";

// Campos para el ProfileCard (usado en UserAvatarMenu)
const profileCardSelect = {
  ...profileSelect,
  bannerAsset: {
    select: uploadedAssetSelect,
  },
  profileCardConfig: true,
  profileCardLeftTopImageAsset: {
    select: uploadedAssetSelect,
  },
  profileCardLeftBottomRightTopImageAsset: {
    select: uploadedAssetSelect,
  },
  profileCardLeftBottomRightBottomImageAsset: {
    select: uploadedAssetSelect,
  },
  profileCardRightTopImageAsset: {
    select: uploadedAssetSelect,
  },
  profileCardRightBottomImageAsset: {
    select: uploadedAssetSelect,
  },
};

/**
 * Obtiene los datos de un perfil para mostrar en el UserAvatarMenu (ProfileCard)
 * Incluye todos los campos necesarios para el popover
 */
export async function getProfileCard(profileId: string) {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: profileCardSelect,
  });

  if (!profile) {
    return null;
  }

  const serializedProfile = serializeProfile(profile);

  return {
    ...serializedProfile,
    bannerAsset: serializeUploadedAsset(profile.bannerAsset),
    profileCardConfig: profile.profileCardConfig,
    profileCardLeftTopImageAsset: serializeUploadedAsset(
      profile.profileCardLeftTopImageAsset,
    ),
    profileCardLeftBottomRightTopImageAsset: serializeUploadedAsset(
      profile.profileCardLeftBottomRightTopImageAsset,
    ),
    profileCardLeftBottomRightBottomImageAsset: serializeUploadedAsset(
      profile.profileCardLeftBottomRightBottomImageAsset,
    ),
    profileCardRightTopImageAsset: serializeUploadedAsset(
      profile.profileCardRightTopImageAsset,
    ),
    profileCardRightBottomImageAsset: serializeUploadedAsset(
      profile.profileCardRightBottomImageAsset,
    ),
  };
}
