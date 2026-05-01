import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export async function deleteBoardRules(boardId: string): Promise<void> {
  const response = await nextApiFetch(`/api/boards/${boardId}/rules`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudieron eliminar las reglas"),
    );
  }
}
