import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export async function getLivekitToken(
  channelId: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await nextApiFetch(
    `/api/livekit?room=${encodeURIComponent(channelId)}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Error al obtener el token de voz"),
    );
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error("No se recibió token de LiveKit");
  return data.token;
}
