import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type {
  BoardBansPage,
  BoardMembersPage,
  BoardMemberRole,
  BoardModerationActionsPage,
  BoardSettingsUpdatedBoard,
} from "../types";

export type UpdateBoardSettingsInput = {
  name: string;
  description?: string | null;
  imageAssetId?: string | null;
  bannerAssetId?: string | null;
};

export async function updateBoardSettings(
  boardId: string,
  input: UpdateBoardSettingsInput,
) {
  const response = await nextApiFetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo actualizar el board"),
    );
  }

  return (await response.json()) as BoardSettingsUpdatedBoard;
}

export async function refreshBoard(boardId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}/refresh`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo hacer bump del board"),
    );
  }
}

export async function getBoardMembers(
  boardId: string,
  cursor: string | null,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);

  const response = await nextApiFetch(
    `/api/boards/${boardId}/members?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudieron cargar los miembros"),
    );
  }

  return (await response.json()) as BoardMembersPage;
}

export async function updateBoardMemberRole(
  boardId: string,
  memberId: string,
  role: BoardMemberRole,
) {
  const response = await nextApiFetch(
    `/api/boards/${boardId}/members/${memberId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
  );

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo cambiar el rol"));
  }
}

export async function kickBoardMember(boardId: string, targetProfileId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}/kick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetProfileId }),
  });

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo expulsar"));
  }
}

export async function banBoardMember(boardId: string, targetProfileId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetProfileId }),
  });

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo banear"));
  }
}

export async function warnBoardMember(boardId: string, targetProfileId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}/warning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetProfileId }),
  });

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo advertir"));
  }

  return (await response.json()) as {
    autoBanned?: boolean;
    warning?: { id?: string };
  };
}

export async function removeBoardWarning(boardId: string, warningId: string) {
  const response = await nextApiFetch(
    `/api/boards/${boardId}/warnings/${warningId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo remover la advertencia"),
    );
  }
}

export async function getBoardBans(boardId: string, cursor: string | null) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);

  const response = await nextApiFetch(
    `/api/boards/${boardId}/bans?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudieron cargar bans"));
  }

  return (await response.json()) as BoardBansPage;
}

export async function unbanBoardMember(boardId: string, targetProfileId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}/unban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetProfileId }),
  });

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo hacer unban"));
  }
}

export async function getBoardModerationActions(
  boardId: string,
  cursor: string | null,
) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);

  const response = await nextApiFetch(
    `/api/boards/${boardId}/moderation-actions?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "No se pudo cargar el historial"),
    );
  }

  return (await response.json()) as BoardModerationActionsPage;
}

export async function deleteBoard(boardId: string) {
  const response = await nextApiFetch(`/api/boards/${boardId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readNextApiError(response, "No se pudo eliminar"));
  }
}
