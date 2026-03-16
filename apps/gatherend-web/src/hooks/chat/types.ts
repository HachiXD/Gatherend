import { Board, Member, MemberRole } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";

export interface ChatMember {
  id: string;
  role: MemberRole;
  profile: ClientProfileSummary;
}

export interface ChatReaction {
  id: string;
  emoji: string;
  profileId: string;
  profile: ClientProfileSummary;
}

export interface ChatReplyTarget {
  id: string;
  content: string;
  attachmentAssetId?: string | null;
  attachmentAsset?: ClientAttachmentAsset | null;
  sender?: ClientProfileSummary;
  member?: ChatMember;
  sticker?: ClientSticker | null;
}

export interface MessageWithMember {
  id: string;
  content: string;
  type?: string;
  attachmentAssetId: string | null;
  attachmentAsset: ClientAttachmentAsset | null;
  deleted: boolean;
  pinned?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  member: ChatMember;
  sticker?: ClientSticker | null;
  reactions?: ChatReaction[];
  replyTo?: ChatReplyTarget | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
}

export interface DirectMessageWithSender {
  id: string;
  content: string;
  attachmentAssetId: string | null;
  attachmentAsset: ClientAttachmentAsset | null;
  deleted: boolean;
  pinned?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  sender: ClientProfileSummary;
  sticker?: ClientSticker | null;
  reactions?: ChatReaction[];
  replyTo?: ChatReplyTarget | null;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
}

export type ChatMessage = MessageWithMember | DirectMessageWithSender;

export interface ChatPage {
  id: string;
  messages: ChatMessage[];
  nextCursor: string | null;
  previousCursor: string | null;
}

export const SKELETON_HEIGHT = 700;
export const MESSAGES_PER_PAGE = 40;

export interface ChatPagesProps {
  queryKey: string[];
  apiUrl: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  profileId: string;
  boardId?: string;
}

export interface ChatMessagesProps {
  name: string;
  currentProfile: ClientProfile;
  currentMember?: Member | null;
  board?: Board;
  apiUrl: string;
  socketQuery: Record<string, string>;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  type: "channel" | "conversation";
}
