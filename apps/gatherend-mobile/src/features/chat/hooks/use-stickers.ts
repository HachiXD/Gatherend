import { useQuery } from "@tanstack/react-query";
import { expressFetch } from "@/src/services/express/express-fetch";
import type { ClientSticker } from "../types";

export const STICKERS_QUERY_KEY = ["stickers"] as const;

async function fetchStickers(profileId: string): Promise<ClientSticker[]> {
  const response = await expressFetch("/stickers", { profileId });

  if (!response.ok) {
    throw new Error("Failed to fetch stickers");
  }

  return response.json() as Promise<ClientSticker[]>;
}

export function useStickers(profileId: string) {
  return useQuery({
    queryKey: STICKERS_QUERY_KEY,
    queryFn: () => fetchStickers(profileId),
    staleTime: 300_000,
  });
}
