import { useQuery } from "@tanstack/react-query";
import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { FeaturedData } from "../domain/featured";

export function boardFeaturedQueryKey(boardId: string) {
  return ["featured", boardId] as const;
}

async function fetchBoardFeatured(boardId: string): Promise<FeaturedData> {
  const res = await nextApiFetch(`/api/boards/${boardId}/featured`);
  if (!res.ok) {
    throw new Error(
      await readNextApiError(res, "Error al cargar el contenido destacado"),
    );
  }
  return res.json() as Promise<FeaturedData>;
}

export function useBoardFeatured(boardId?: string) {
  return useQuery({
    queryKey: boardFeaturedQueryKey(boardId ?? ""),
    queryFn: () => fetchBoardFeatured(boardId!),
    enabled: Boolean(boardId),
    staleTime: 5 * 60 * 1000,
  });
}
