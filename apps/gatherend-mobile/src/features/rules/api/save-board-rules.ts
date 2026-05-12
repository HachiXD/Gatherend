import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { ClientBoardRules } from "../domain/rules";

export type SaveBoardRulesInput = {
  boardId: string;
  isEdit: boolean;
  content: string;
};

export async function saveBoardRules(
  input: SaveBoardRulesInput,
): Promise<ClientBoardRules> {
  const response = await nextApiFetch(`/api/boards/${input.boardId}/rules`, {
    method: input.isEdit ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.content }),
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(
        response,
        input.isEdit
          ? "No se pudieron actualizar las reglas"
          : "No se pudieron crear las reglas",
      ),
    );
  }

  return (await response.json()) as ClientBoardRules;
}
