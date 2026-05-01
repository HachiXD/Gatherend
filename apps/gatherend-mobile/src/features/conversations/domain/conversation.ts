import type { ClientPublicAsset } from "@/src/features/chat/types";

export type ConversationProfile = {
  id: string;
  username: string;
  discriminator: string | null;
  email: string;
  userId: string;
  usernameColor: unknown;
  usernameFormat: unknown;
  chatBubbleStyle?: unknown;
  avatarAsset: ClientPublicAsset | null;
};

export type ConversationLastMessage = {
  content: string;
  deleted: boolean;
  senderId: string;
  hasAttachment?: boolean;
  stickerName?: string | null;
};

export type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  profileOneId: string;
  profileTwoId: string;
  hiddenByOneAt: string | null;
  hiddenByTwoAt: string | null;
  lastReadByOneAt: string | null;
  lastReadByTwoAt: string | null;
  profileOne: ConversationProfile;
  profileTwo: ConversationProfile;
  otherProfile: ConversationProfile;
  isOne: boolean;
  lastMessage: ConversationLastMessage | null;
};
