import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export type InviteCodeAction = "regenerate" | "enable" | "disable";

export interface UpdatedInviteCode {
  id: string;
  inviteCode: string;
  inviteEnabled: boolean;
}

export async function updateInviteCode(
  boardId: string,
  action: InviteCodeAction,
): Promise<UpdatedInviteCode> {
  const response = await nextApiFetch(
    `/api/boards/${boardId}/invite-code`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    },
  );
  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Error al actualizar el código de invitación"),
    );
  }
  return (await response.json()) as UpdatedInviteCode;
}
