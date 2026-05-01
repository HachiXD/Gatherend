import type {
  ChatReaction,
  ChatReplyTarget,
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/src/features/chat/types";

export type DirectMessage = {
  id: string;
  content: string;
  attachmentAssetId: string | null;
  attachmentAsset: ClientAttachmentAsset | null;
  conversationId: string;
  senderId: string | null;
  sender: ClientProfileSummary | null;
  stickerId: string | null;
  sticker: ClientSticker | null;
  deleted: boolean;
  pinned: boolean;
  pinnedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  reactions?: ChatReaction[];
  replyTo?: ChatReplyTarget | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  tempId?: string;
  isOptimistic?: boolean;
};

export type DirectMessagesPage = {
  items: DirectMessage[];
  nextCursor: string | null;
  previousCursor: string | null;
};
