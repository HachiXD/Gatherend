import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export type JoinBoardResult = {
  success: boolean;
  alreadyMember: boolean;
  targetChannelId: string | null;
  redirectUrl: string | null;
};

export async function joinBoard({
  boardId,
  inviteCode,
}: {
  boardId: string;
  inviteCode: string;
}): Promise<JoinBoardResult> {
  const response = await nextApiFetch(
    `/api/boards/${boardId}/join?source=invitation&inviteCode=${encodeURIComponent(inviteCode)}`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Failed to join board"),
    );
  }

  return (await response.json()) as JoinBoardResult;
}
