import { db } from "../../lib/db.js";
import {
  profileSelect,
  serializeProfile,
} from "../../lib/uploaded-assets.js";

// Campos para el ProfileCard (usado en UserAvatarMenu)
const profileCardSelect = {
  ...profileSelect,
  longDescription: true,
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

  return profile ? serializeProfile(profile) : null;
}
