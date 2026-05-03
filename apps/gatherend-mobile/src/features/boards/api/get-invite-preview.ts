import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { BoardImageAsset } from "../types/board";

export type InvitePreviewData = {
  id: string;
  name: string;
  imageAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  memberCount: number;
  size: number;
  inviteCode: string;
};

export async function getInvitePreview(
  inviteCode: string,
): Promise<InvitePreviewData> {
  const response = await nextApiFetch(
    `/api/boards/invite-preview/${inviteCode}`,
  );

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Failed to load invite preview"),
    );
  }

  return (await response.json()) as InvitePreviewData;
}
