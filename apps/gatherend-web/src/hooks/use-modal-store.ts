import { create } from "zustand";
import { Category, Channel, ChannelType, Board, Profile } from "@prisma/client";

export type ModalType =
  | "createBoard"
  | "createCommunityPost"
  | "createCommunity"
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
  | "reportCommunity";

interface ModalData {
  channelId?: string;
  categoryId?: string | null;
  categoryName?: string;
  profileId?: string;
  board?: Board;
  boardId?: string; // Alternativa a board completo para evitar re-renders
  channel?: Partial<Channel>;
  channelType?: ChannelType;
  category?: Category;
  apiUrl?: string;
  query?: Record<string, unknown>;
  conversationId?: string;
  roomType?: "channel" | "conversation";
  // Report message modal data
  messageId?: string;
  messageContent?: string;
  messageType?: "MESSAGE" | "DIRECT_MESSAGE";
  authorProfile?: Profile;
  fileUrl?: string | null;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  } | null;
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
  // Report community modal data
  reportCommunityId?: string;
  reportCommunityName?: string;
  reportCommunityImageUrl?: string | null;
  communityId?: string;
  communityName?: string;
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
