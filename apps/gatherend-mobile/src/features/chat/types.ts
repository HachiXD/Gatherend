export type FetchDirection = "before" | "after";
export const CHAT_MESSAGES_PAGE_SIZE = 40;

export type ClientPublicAsset = {
  id: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  url: string | null;
};

export type ClientAttachmentAsset = ClientPublicAsset & {
  mimeType: string;
  sizeBytes: number | null;
  originalName: string | null;
};

export type ClientStickerAssetRef = {
  id: string;
  asset: ClientPublicAsset | null;
};

export type ClientSticker = {
  id: string;
  name: string;
  category: string;
  asset: ClientPublicAsset | null;
  uploaderId?: string | null;
  isCustom?: boolean;
};

export type ClientProfileSummary = {
  id: string;
  username: string;
  discriminator: string | null;
  usernameColor: unknown;
  profileTags: string[];
  badge: string | null;
  usernameFormat: unknown;
  chatBubbleStyle?: unknown;
  avatarAsset: ClientPublicAsset | null;
  badgeSticker: ClientStickerAssetRef | null;
};

export type ChatMember = {
  id: string;
  role: string;
  profile: ClientProfileSummary;
};

export type ChatReaction = {
  id: string;
  emoji: string;
  profileId: string;
  profile: ClientProfileSummary;
};

export type ChatReplyTarget = {
  id: string;
  content: string;
  attachmentAssetId?: string | null;
  attachmentAsset?: ClientAttachmentAsset | null;
  messageSenderId?: string | null;
  messageSender?: ClientProfileSummary | null;
  sender?: ClientProfileSummary;
  member?: ChatMember | null;
  sticker?: ClientSticker | null;
};

export type ChannelMessage = {
  id: string;
  content: string;
  type?: string;
  seq?: number;
  attachmentAssetId: string | null;
  attachmentAsset: ClientAttachmentAsset | null;
  deleted: boolean;
  pinned?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  messageSenderId: string | null;
  messageSender: ClientProfileSummary | null;
  member?: ChatMember | null;
  sticker?: ClientSticker | null;
  reactions?: ChatReaction[];
  replyTo?: ChatReplyTarget | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  channelId?: string;
  tempId?: string;
  isOptimistic?: boolean;
};

export type ChatPage = {
  items: ChannelMessage[];
  nextCursor: string | null;
  previousCursor: string | null;
};
