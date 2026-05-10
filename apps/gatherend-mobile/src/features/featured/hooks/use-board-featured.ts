import { useInfiniteQuery } from "@tanstack/react-query";
import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { FeaturedPostsPage } from "../domain/featured";

export function boardFeaturedQueryKey(boardId: string) {
  return ["featured", boardId] as const;
}

async function fetchBoardFeatured(
  boardId: string,
  cursor?: string | null,
): Promise<FeaturedPostsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  const url = `/api/boards/${boardId}/featured${query ? `?${query}` : ""}`;
  const res = await nextApiFetch(url);
  if (!res.ok) {
    throw new Error(
      await readNextApiError(res, "Error al cargar el contenido destacado"),
    );
  }
  return res.json() as Promise<FeaturedPostsPage>;
}

export function useBoardFeatured(boardId?: string) {
  return useInfiniteQuery({
    queryKey: boardFeaturedQueryKey(boardId ?? ""),
    queryFn: ({ pageParam }) => fetchBoardFeatured(boardId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!boardId,
  });
}
