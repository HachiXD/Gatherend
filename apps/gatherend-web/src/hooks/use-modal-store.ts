import { create } from "zustand";
import { Channel, ChannelType } from "@prisma/client";
import type { BoardWithData } from "@/lib/boards/board-types";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";

export type ModalType =
  | "createBoard"
  | "invite"
  | "editBoard"
  | "members"
  | "createChannel"
  | "leaveBoard"
  | "deleteBoard"
  | "deleteChannel"
  | "editChannel"
  | "messageFile"
  | "deleteMessage"
  | "createCategory"
  | "editCategory"
  | "deleteCategory"
  | "addFriend"
  | "pinnedMessages"
  | "reportMessage"
  | "reportBoard"
  | "reportProfile"
  | "reportCommunityPost"
  | "reportCommunityPostComment"
  | "deleteCommunityPost"
  | "deleteCommunityPostComment";

interface ModalData {
  channelId?: string;
  categoryId?: string | null;
  categoryName?: string;
  profileId?: string;
  board?: BoardWithData;
  boardId?: string; // Alternativa a board completo para evitar re-renders
  channel?: Partial<Channel>;
  channelType?: ChannelType;
  category?: { id: string; name: string };
  apiUrl?: string;
  query?: Record<string, unknown>;
  conversationId?: string;
  roomType?: "channel" | "conversation";
  // Report message modal data
  messageId?: string;
  messageContent?: string;
  messageType?: "MESSAGE" | "DIRECT_MESSAGE";
  authorProfile?: ClientProfileSummary;
  attachmentAsset?: ClientAttachmentAsset | null;
  sticker?: ClientSticker | null;
  // Report board modal data
  reportBoardId?: string;
  reportBoardName?: string;
  reportBoardDescription?: string | null;
  reportBoardImageUrl?: string | null;
  // Report profile modal data
  reportProfileId?: string;
  reportProfileUsername?: string;
  reportProfileDiscriminator?: string | null;
  reportProfileImageUrl?: string;
  // Report community post modal data
  reportCommunityPostId?: string;
  reportCommunityPostContent?: string;
  reportCommunityPostImageUrl?: string | null;
  reportCommunityPostAuthorId?: string;
  reportCommunityPostAuthorUsername?: string;
  reportCommunityPostAuthorDiscriminator?: string | null;
  reportCommunityPostCommentId?: string;
  reportCommunityPostCommentContent?: string;
  reportCommunityPostCommentImageUrl?: string | null;
  reportCommunityPostCommentAuthorId?: string;
  reportCommunityPostCommentAuthorUsername?: string;
  reportCommunityPostCommentAuthorDiscriminator?: string | null;
  deleteCommunityPostId?: string;
  deleteCommunityPostCommunityId?: string;
  deleteCommunityPostCommentId?: string;
  onDeleteCommunityPostCommentConfirm?: (() => Promise<void>) | (() => void);
}

interface ModalStore {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: () => void;
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  onOpen: (type, data = {}) => set({ isOpen: true, type, data }),
  onClose: () => set({ type: null, isOpen: false }),
}));
