import { db } from "../../lib/db.js";
import { findConversationForProfileCached } from "../../lib/cache.js";
import {
  profileSelect,
  serializeProfile,
  serializeSticker,
  serializeAttachmentAsset,
  stickerSelect,
  uploadedAssetSelect,
} from "../../lib/uploaded-assets.js";

export const directMessageSelect = {
  id: true,
  content: true,
  attachmentAssetId: true,
  conversationId: true,
  senderId: true,
  stickerId: true,
  deleted: true,
  pinned: true,
  pinnedAt: true,
  createdAt: true,
  updatedAt: true,
  attachmentAsset: {
    select: uploadedAssetSelect,
  },
  sender: {
    select: profileSelect,
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
      attachmentAsset: {
        select: uploadedAssetSelect,
      },
      sender: {
        select: profileSelect,
      },
      sticker: {
        select: stickerSelect,
      },
    },
  },
} as const;

export function serializeDirectMessage(message: any) {
  return {
    ...message,
    attachmentAsset: serializeAttachmentAsset(message.attachmentAsset),
    sender: serializeProfile(message.sender),
    sticker: serializeSticker(message.sticker),
    reactions: message.reactions?.map((reaction: any) => ({
      ...reaction,
      profile: serializeProfile(reaction.profile),
    })),
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          attachmentAsset: serializeAttachmentAsset(
            message.replyTo.attachmentAsset,
          ),
          sender: serializeProfile(message.replyTo.sender),
          sticker: serializeSticker(message.replyTo.sticker),
        }
      : null,
  };
}

export const findConversationForProfile = async (
  profileId: string,
  conversationId: string,
) => {
  const cached = await findConversationForProfileCached(
    profileId,
    conversationId,
  );

  if (!cached) return null;

  const { conversation, currentProfileId, otherProfileId } = cached;

  return {
    conversation: {
      ...conversation,
      profileOne: conversation.profileOne,
      profileTwo: conversation.profileTwo,
    },
    currentProfile:
      conversation.profileOneId === currentProfileId
        ? conversation.profileOne
        : conversation.profileTwo,
    otherProfile:
      conversation.profileOneId === otherProfileId
        ? conversation.profileOne
        : conversation.profileTwo,
  };
};

export const createDirectMessage = async (data: {
  content: string;
  attachmentAssetId: string | null;
  conversationId: string;
  conversationProfileOneId?: string | null;
  conversationProfileTwoId?: string | null;
  senderId: string;
  unhideForProfileId?: string | null;
  stickerId?: string | null;
  replyToId?: string | null;
}) => {
  const {
    conversationProfileOneId = null,
    conversationProfileTwoId = null,
    unhideForProfileId = null,
    ...messageData
  } = data;

  const updateConversationData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (unhideForProfileId) {
    if (conversationProfileOneId === unhideForProfileId) {
      updateConversationData.hiddenByOneAt = null;
    }
    if (conversationProfileTwoId === unhideForProfileId) {
      updateConversationData.hiddenByTwoAt = null;
    }
  }

  const [message] = await db.$transaction([
    db.directMessage.create({
      data: messageData,
      select: directMessageSelect,
    }),
    db.conversation.update({
      where: { id: data.conversationId },
      data: updateConversationData,
    }),
  ]);

  return serializeDirectMessage(message);
};

export const getPaginatedDirectMessages = async (
  conversationId: string,
  cursor?: string,
  direction: "before" | "after" = "before",
) => {
  if (direction === "after" && cursor) {
    const messages = await db.directMessage.findMany({
      take: 40,
      skip: 1,
      cursor: { id: cursor },
      where: { conversationId },
      select: directMessageSelect,
      orderBy: { createdAt: "asc" },
    });

    return messages.reverse().map(serializeDirectMessage);
  }

  const messages = await db.directMessage.findMany({
    take: 40,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    where: { conversationId },
    select: directMessageSelect,
    orderBy: { createdAt: "desc" },
  });

  return messages.map(serializeDirectMessage);
};
