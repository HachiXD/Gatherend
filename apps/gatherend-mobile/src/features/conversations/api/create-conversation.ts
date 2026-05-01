import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export async function createConversation(
  profileId: string,
): Promise<{ id: string }> {
  const response = await nextApiFetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId }),
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo abrir la conversación"),
    );
  }

  return (await response.json()) as { id: string };
}
