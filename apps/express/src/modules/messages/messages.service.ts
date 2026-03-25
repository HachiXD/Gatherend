import { MessageType } from "@prisma/client";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import {
  profileSelect,
  serializeProfile,
  serializeSticker,
  serializeAttachmentAsset,
  stickerSelect,
  uploadedAssetSelect,
} from "../../lib/uploaded-assets.js";

export const messageSelectFields = {
  id: true,
  content: true,
  type: true,
  attachmentAssetId: true,
  messageSenderId: true,
  channelId: true,
  deleted: true,
  pinned: true,
  pinnedAt: true,
  createdAt: true,
  updatedAt: true,
  attachmentAsset: {
    select: uploadedAssetSelect,
  },
  messageSender: {
    select: profileSelect,
  },
  member: {
    select: {
      id: true,
      role: true,
      profile: {
        select: profileSelect,
      },
    },
  },
  sticker: {
    select: stickerSelect,
  },
  reactions: {
    select: {
      id: true,
      emoji: true,
      profileId: true,
      profile: {
        select: profileSelect,
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      attachmentAssetId: true,
      messageSenderId: true,
      attachmentAsset: {
        select: uploadedAssetSelect,
      },
      messageSender: {
        select: profileSelect,
      },
      member: {
        select: {
          id: true,
          profile: {
            select: profileSelect,
          },
        },
      },
      sticker: {
        select: stickerSelect,
      },
    },
  },
} as const;

function serializeOptionalProfile(profile: any) {
  return profile ? serializeProfile(profile) : null;
}

export function serializeMessageRecord(message: any) {
  const {
    attachmentAsset,
    messageSender,
    member,
    sticker,
    reactions,
    replyTo,
    ...rest
  } = message;

  return {
    ...rest,
    attachmentAsset: serializeAttachmentAsset(attachmentAsset),
    messageSender: serializeOptionalProfile(messageSender ?? member?.profile ?? null),
    sticker: serializeSticker(sticker),
    reactions: reactions?.map((reaction: any) => ({
      ...reaction,
      profile: serializeOptionalProfile(reaction.profile),
    })),
    replyTo: replyTo
      ? {
          ...replyTo,
          attachmentAsset: serializeAttachmentAsset(
            replyTo.attachmentAsset,
          ),
          messageSender: serializeOptionalProfile(
            replyTo.messageSender ?? replyTo.member?.profile ?? null,
          ),
          sticker: serializeSticker(replyTo.sticker),
        }
      : null,
  };
}

export function extractMentionIdentifiers(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\/\[([^\]]+)\]/g;
  const identifiers: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    identifiers.push(`${match[1]}/${match[2]}`);
  }

  return [...new Set(identifiers)];
}

export async function resolveProfileIds(
  identifiers: string[],
): Promise<string[]> {
  if (identifiers.length === 0) return [];

  try {
    const conditions = identifiers
      .map((identifier) => {
        const [username, discriminator] = identifier.split("/");
        if (!username || !discriminator) return null;
        return { username, discriminator };
      })
      .filter(
        (condition): condition is { username: string; discriminator: string } =>
          condition !== null,
      );

    if (conditions.length === 0) return [];

    const profiles = await db.profile.findMany({
      where: {
        OR: conditions,
      },
      select: { id: true },
    });

    return profiles.map((p) => p.id);
  } catch (error) {
    logger.error("[resolveProfileIds] Database error:", error);
    return [];
  }
}

export async function createMentions(messageId: string, profileIds: string[]) {
  if (profileIds.length === 0) return [];

  try {
    const mentions = await db.mention.createMany({
      data: profileIds.map((profileId) => ({
        messageId,
        profileId,
      })),
      skipDuplicates: true,
    });

    return mentions;
  } catch (error) {
    logger.error("[createMentions] Database error:", error);
    return { count: 0 };
  }
}

export async function verifyMemberInBoard(profileId: string, boardId: string) {
  return db.board.findFirst({
    where: {
      id: boardId,
      members: { some: { profileId } },
    },
    include: { members: true },
  });
}

export async function findChannel(boardId: string, channelId: string) {
  return db.channel.findFirst({
    where: { id: channelId, boardId },
  });
}

export async function createMessage({
  content,
  attachmentAssetId,
  channelId,
  memberId,
  messageSenderId,
  stickerId,
  type,
  replyToId,
}: {
  content: string;
  attachmentAssetId: string | null;
  channelId: string;
  memberId: string;
  messageSenderId: string;
  stickerId?: string | null;
  type: MessageType;
  replyToId?: string | null;
}) {
  const message = await db.message.create({
    data: {
      content,
      attachmentAssetId,
      channelId,
      memberId,
      messageSenderId,
      stickerId,
      type,
      replyToId,
    },
    select: messageSelectFields,
  });

  return serializeMessageRecord(message);
}

export async function getPaginatedMessages(
  channelId: string,
  cursor?: string,
  direction: "before" | "after" = "before",
) {
  const PAGE_SIZE = 40;

  if (direction === "after" && cursor) {
    const messages = await db.message
      .findMany({
        take: PAGE_SIZE,
        skip: 1,
        cursor: { id: cursor },
        where: { channelId },
        select: messageSelectFields,
        orderBy: { createdAt: "asc" },
      })
      .then((items) => items.reverse());

    return messages.map(serializeMessageRecord);
  }

  const messages = await db.message.findMany({
    take: PAGE_SIZE,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    where: { channelId },
    select: messageSelectFields,
    orderBy: { createdAt: "desc" },
  });

  return messages.map(serializeMessageRecord);
}

export async function getMessagesByIds(channelId: string, ids: string[]) {
  if (ids.length === 0) return [];

  const messages = await db.message.findMany({
    where: {
      channelId,
      id: { in: ids },
    },
    select: messageSelectFields,
  });

  const serializedById = new Map(
    messages.map((message) => [message.id, serializeMessageRecord(message)]),
  );

  return ids
    .map((id) => serializedById.get(id))
    .filter((message): message is NonNullable<typeof message> => Boolean(message));
}

export async function getMessage(messageId: string, channelId: string) {
  const message = await db.message.findFirst({
    where: {
      id: messageId,
      channelId,
    },
    select: messageSelectFields,
  });

  return message ? serializeMessageRecord(message) : null;
}

export async function updateMessageContent(messageId: string, content: string) {
  const message = await db.message.update({
    where: { id: messageId },
    data: { content },
    select: messageSelectFields,
  });

  return serializeMessageRecord(message);
}

export async function softDeleteMessage(messageId: string) {
  const message = await db.message.update({
    where: { id: messageId },
    data: {
      attachmentAssetId: null,
      content: "This message has been deleted.",
      deleted: true,
    },
    select: messageSelectFields,
  });

  return serializeMessageRecord(message);
}

export function hardDeleteMessage(messageId: string) {
  return db.message.delete({
    where: { id: messageId },
  });
}
