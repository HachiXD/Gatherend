import { db } from "@/lib/db";
import { parseFullUsername } from "./format";
import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

const searchableProfileSelect = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  },
} as const;

/**
 * Busca un perfil por username completo (username/discriminator)
 */
export async function findProfileByFullUsername(fullUsername: string) {
  const parsed = parseFullUsername(fullUsername);
  if (!parsed) {
    return null;
  }

  const profile = await db.profile.findFirst({
    where: {
      username: { equals: parsed.username, mode: "insensitive" },
      discriminator: parsed.discriminator,
    },
    select: searchableProfileSelect,
  });

  return profile ? serializeProfileSummary(profile) : null;
}

/**
 * Busca perfiles por username base (sin discriminador)
 * Útil para mostrar sugerencias al usuario
 */
export async function findProfilesByUsername(
  username: string,
  limit: number = 10,
) {
  const profiles = await db.profile.findMany({
    where: {
      username: {
        contains: username,
        mode: "insensitive",
      },
    },
    select: searchableProfileSelect,
    take: limit,
  });

  return profiles.map(serializeProfileSummary);
}
