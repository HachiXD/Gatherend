import { create } from "zustand";
import type {
  ClientAttachmentAsset,
  ClientProfileSummary,
  ClientSticker,
} from "@/types/uploaded-assets";

interface ReplyMessage {
  id: string;
  content: string;
  sender: ClientProfileSummary;
  attachmentAsset?: ClientAttachmentAsset | null;
  fileName?: string | null;
  sticker?: ClientSticker | null;
}

interface ReplyStore {
  replyingTo: ReplyMessage | null;
  roomId: string | null;
  focusTrigger: number;
  setReplyingTo: (message: ReplyMessage | null, roomId?: string) => void;
  clearReply: () => void;
}

export const useReplyStore = create<ReplyStore>((set) => ({
  replyingTo: null,
  roomId: null,
  focusTrigger: 0,
  setReplyingTo: (message, roomId) =>
    set((state) => ({
      replyingTo: message,
      roomId: roomId || null,
      focusTrigger: message ? state.focusTrigger + 1 : state.focusTrigger,
    })),
  clearReply: () => set({ replyingTo: null, roomId: null }),
}));
