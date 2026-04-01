import type { Prisma } from "@prisma/client";

export async function reserveChannelMessageSeqRange(
  tx: Prisma.TransactionClient,
  channelId: string,
  count: number,
): Promise<number> {
  if (count <= 0) {
    return 0;
  }

  const channel = await tx.channel.update({
    where: { id: channelId },
    data: {
      lastMessageSeq: {
        increment: count,
      },
    },
    select: {
      lastMessageSeq: true,
    },
  });

  return channel.lastMessageSeq - count + 1;
}

export async function upsertBoardReadStatesForChannel(
  tx: Prisma.TransactionClient,
  options: {
    boardId: string;
    channelId: string;
    lastReadSeq: number;
  },
): Promise<void> {
  const members = await tx.member.findMany({
    where: { boardId: options.boardId },
    select: { profileId: true },
  });

  if (members.length === 0) {
    return;
  }

  const now = new Date();

  await tx.channelReadState.createMany({
    data: members.map((member) => ({
      profileId: member.profileId,
      channelId: options.channelId,
      lastReadSeq: options.lastReadSeq,
      lastReadAt: now,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });
}

export async function createReadStatesForBoardJoin(
  tx: Prisma.TransactionClient,
  options: {
    boardId: string;
    profileId: string;
  },
): Promise<void> {
  const channels = await tx.channel.findMany({
    where: { boardId: options.boardId },
    select: {
      id: true,
      lastMessageSeq: true,
    },
  });

  if (channels.length === 0) {
    return;
  }

  const now = new Date();

  await tx.channelReadState.createMany({
    data: channels.map((channel) => ({
      profileId: options.profileId,
      channelId: channel.id,
      lastReadSeq: channel.lastMessageSeq,
      lastReadAt: now,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });
}

export async function upsertChannelReadState(
  tx: Prisma.TransactionClient,
  options: {
    profileId: string;
    channelId: string;
    lastReadSeq: number;
  },
) {
  const now = new Date();

  return tx.channelReadState.upsert({
    where: {
      profileId_channelId: {
        profileId: options.profileId,
        channelId: options.channelId,
      },
    },
    create: {
      profileId: options.profileId,
      channelId: options.channelId,
      lastReadSeq: options.lastReadSeq,
      lastReadAt: now,
      unreadCount: 0,
    },
    update: {
      lastReadSeq: options.lastReadSeq,
      lastReadAt: now,
      unreadCount: 0,
    },
  });
}
