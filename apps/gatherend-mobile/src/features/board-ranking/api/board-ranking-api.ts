import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { BoardRankingPage } from "../types";

export async function getBoardRanking(boardId: string, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);

  const response = await nextApiFetch(
    `/api/boards/${boardId}/ranking?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo cargar el ranking"),
    );
  }

  return (await response.json()) as BoardRankingPage;
}
