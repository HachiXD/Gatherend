import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { ClientBoardRules } from "../domain/rules";

export async function getBoardRules(
  boardId: string,
): Promise<ClientBoardRules | null> {
  const response = await nextApiFetch(`/api/boards/${boardId}/rules`);
  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Error al cargar las reglas"),
    );
  }
  const data = (await response.json()) as { rules: ClientBoardRules | null };
  return data.rules;
}
