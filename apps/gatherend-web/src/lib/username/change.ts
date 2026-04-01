import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeUsername, validateUsername } from "./sanitize";
import {
  isDiscriminatorAvailable,
  generateUniqueDiscriminator,
} from "./discriminator";

/**
 * Cambia el username de un profile
 *
 * Lógica:
 * - Si el discriminator actual está libre en el nuevo username → mantenerlo
 * - Si hay conflicto → generar nuevo discriminator
 *
 * @returns El nuevo username completo y si el discriminator cambió
 */
export async function changeUsername(
  profileId: string,
  newUsername: string,
): Promise<{
  username: string;
  discriminator: string;
  discriminatorChanged: boolean;
}> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { discriminator: true, username: true, userId: true },
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  const normalizedUsername = normalizeUsername(newUsername);
  const validationError = validateUsername(normalizedUsername);
  if (validationError) {
    throw new Error(validationError);
  }

  if (normalizedUsername.length < 2 || normalizedUsername.length > 20) {
    throw new Error("Username must be between 2 and 20 characters");
  }

  // Verificar si podemos mantener el discriminator actual
  const canKeep = await isDiscriminatorAvailable(
    normalizedUsername,
    profile.discriminator,
  );

  if (canKeep) {
    // Sin conflicto: mantener discriminator
    await db.profile.update({
        where: { id: profileId },
        data: { username: normalizedUsername },
      });

    await db.user.update({
      where: { id: profile.userId },
      data: { name: normalizedUsername },
      select: { id: true },
    });

    logger.server(
      "[USERNAME_CHANGE] Kept discriminator:",
      profile.discriminator,
      "for new username:",
      normalizedUsername,
    );

    return {
      username: normalizedUsername,
      discriminator: profile.discriminator,
      discriminatorChanged: false,
    };
  }

  // Hay conflicto: generar nuevo discriminator
  const newDiscriminator =
    await generateUniqueDiscriminator(normalizedUsername);

  await db.profile.update({
    where: { id: profileId },
    data: { username: normalizedUsername, discriminator: newDiscriminator },
  });

  await db.user.update({
    where: { id: profile.userId },
    data: { name: normalizedUsername },
    select: { id: true },
  });

  logger.server(
    "[USERNAME_CHANGE] Changed discriminator from",
    profile.discriminator,
    "to",
    newDiscriminator,
    "for username:",
    normalizedUsername,
  );

  return {
    username: normalizedUsername,
    discriminator: newDiscriminator,
    discriminatorChanged: true,
  };
}
