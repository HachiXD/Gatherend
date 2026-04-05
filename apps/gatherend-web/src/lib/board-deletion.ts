import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { serializeUploadedAsset, uploadedAssetSummarySelect } from "@/lib/uploaded-assets";
import {
  expressChannelCache,
  expressMemberCache,
  expressVoiceChannelsCache,
} from "@/lib/redis";

const boardDeletionSelect = {
  id: true,
  name: true,
  description: true,
  isPrivate: true,
  inviteEnabled: true,
  hiddenFromFeed: true,
  profileId: true,
  reportCount: true,
  memberCount: true,
  riskPoints: true,
  riskLevel: true,
  createdAt: true,
  imageAsset: {
    select: uploadedAssetSummarySelect,
  },
  members: {
    select: { profileId: true },
  },
  channels: {
    select: { id: true },
  },
} satisfies Prisma.BoardSelect;

type BoardDeletionSnapshotRecord = Prisma.BoardGetPayload<{
  select: typeof boardDeletionSelect;
}>;

export function serializeBoardDeletionSnapshot(board: BoardDeletionSnapshotRecord) {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    isPrivate: board.isPrivate,
    inviteEnabled: board.inviteEnabled,
    hiddenFromFeed: board.hiddenFromFeed,
    profileId: board.profileId,
    reportCount: board.reportCount,
    memberCount: board.memberCount,
    riskPoints: board.riskPoints,
    riskLevel: board.riskLevel,
    createdAt: board.createdAt.toISOString(),
    imageAsset: serializeUploadedAsset(board.imageAsset),
  } as const;
}

export async function loadBoardDeletionSnapshot(
  tx: Prisma.TransactionClient,
  boardId: string,
) {
  return tx.board.findUnique({
    where: { id: boardId },
    select: boardDeletionSelect,
  });
}

export async function deleteBoardAndCollectState(
  tx: Prisma.TransactionClient,
  boardId: string,
) {
  const board = await loadBoardDeletionSnapshot(tx, boardId);

  if (!board) {
    throw new Error("NOT_FOUND");
  }

  await tx.board.delete({
    where: { id: boardId },
  });

  return {
    snapshot: serializeBoardDeletionSnapshot(board),
    memberProfileIds: board.members
      .map((member) => member.profileId)
      .filter((profileId): profileId is string => !!profileId),
    channelIds: board.channels.map((channel) => channel.id),
  };
}

export async function invalidateDeletedBoardState(
  boardId: string,
  memberProfileIds: string[],
  channelIds: string[],
) {
  await Promise.all([
    expressMemberCache.invalidateMany(boardId, memberProfileIds),
    expressChannelCache.invalidateMany(channelIds),
    expressVoiceChannelsCache.invalidate(boardId),
  ]);

  revalidatePath("/boards");
}

export async function notifyBoardDeleted(
  boardId: string,
  memberProfileIds: string[],
  deletedByProfileId: string,
) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    if (!socketUrl || !secret) return;

    const payload = {
      boardId,
      deletedByProfileId,
      timestamp: Date.now(),
    };

    await Promise.allSettled([
      fetch(`${socketUrl}/emit-to-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({
          room: `board:${boardId}`,
          event: "board:deleted",
          data: payload,
        }),
        signal: AbortSignal.timeout(3000),
      }),
      ...memberProfileIds.map((profileId) =>
        fetch(`${socketUrl}/emit-to-room`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": secret,
          },
          body: JSON.stringify({
            room: `profile:${profileId}`,
            event: "board:deleted",
            data: payload,
          }),
          signal: AbortSignal.timeout(3000),
        }),
      ),
    ]);
  } catch (error) {
    console.error("[NOTIFY_BOARD_DELETED]", error);
  }
}
