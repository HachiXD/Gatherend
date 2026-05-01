import { expressFetch } from "@/src/services/express/express-fetch";

export async function removeReaction(
  reactionId: string,
  profileId: string,
): Promise<void> {
  const response = await expressFetch(`/reactions/${reactionId}`, {
    method: "DELETE",
    profileId,
  });

  if (!response.ok) {
    throw new Error("No se pudo quitar la reacción");
  }
}
