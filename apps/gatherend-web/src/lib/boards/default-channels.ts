import { ChannelType, Prisma } from "@prisma/client";
import {
  reserveChannelMessageSeqRange,
  upsertChannelReadState,
} from "@/lib/channels/read-state";

const DEFAULT_BOARD_CHANNELS = [
  {
    name: "Main",
    type: ChannelType.TEXT,
    position: 1000,
  },
  {
    name: "VR",
    type: ChannelType.VOICE,
    position: 2000,
  },
] as const;

export async function createDefaultBoardChannelsForOwner(
  tx: Prisma.TransactionClient,
  options: {
    boardId: string;
    ownerMemberId: string;
    ownerProfileId: string;
  },
) {
  const createdChannels = [];

  for (const channel of DEFAULT_BOARD_CHANNELS) {
    const createdChannel = await tx.channel.create({
      data: {
        name: channel.name,
        type: channel.type,
        position: channel.position,
        boardId: options.boardId,
        profileId: options.ownerProfileId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        position: true,
        boardId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.channelMember.create({
      data: {
        channelId: createdChannel.id,
        profileId: options.ownerProfileId,
      },
    });

    const seq = await reserveChannelMessageSeqRange(tx, createdChannel.id, 1);

    await tx.message.create({
      data: {
        channelId: createdChannel.id,
        seq,
        type: "WELCOME",
        content: "",
        memberId: options.ownerMemberId,
        messageSenderId: options.ownerProfileId,
      },
    });

    await upsertChannelReadState(tx, {
      profileId: options.ownerProfileId,
      channelId: createdChannel.id,
      lastReadSeq: seq,
    });

    createdChannels.push(createdChannel);
  }

  return createdChannels;
}
