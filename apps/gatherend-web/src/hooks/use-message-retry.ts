import { create } from "zustand";
import type {
  ClientAttachmentAsset,
  ClientSticker,
} from "@/types/uploaded-assets";

interface RetryMessageData {
  tempId: string;
  content: string;
  attachmentAsset?: ClientAttachmentAsset | null;
  sticker?: ClientSticker;
  apiUrl: string;
  query: Record<string, string>;
  profileId: string;
  queryKey: string[];
  replyToId?: string;
}

interface MessageRetryStore {
  retryData: Record<string, RetryMessageData>;
  setRetryData: (tempId: string, data: RetryMessageData) => void;
  getRetryData: (tempId: string) => RetryMessageData | undefined;
  removeRetryData: (tempId: string) => void;
}

export const useMessageRetryStore = create<MessageRetryStore>((set, get) => ({
  retryData: {},
  setRetryData: (tempId, data) => {
    set((state) => ({
      retryData: {
        ...state.retryData,
        [tempId]: data,
      },
    }));
  },
  getRetryData: (tempId) => get().retryData[tempId],
  removeRetryData: (tempId) => {
    set((state) => {
      const { [tempId]: _, ...rest } = state.retryData;
      return { retryData: rest };
    });
  },
}));
