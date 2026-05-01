import type { Conversation } from "./conversation";
import type { DirectMessage, DirectMessagesPage } from "./direct-message";

export type ConversationRepository = {
  getConversation: (conversationId: string, profileId: string) => Promise<Conversation>;
  getDirectMessages: (input: {
    conversationId: string;
    cursor?: string;
    direction?: "before" | "after";
    profileId: string;
  }) => Promise<DirectMessagesPage>;
  hideConversation: (conversationId: string) => Promise<void>;
  listConversations: () => Promise<Conversation[]>;
  sendDirectMessage: (input: {
    conversationId: string;
    content: string;
    profileId: string;
    tempId: string;
    attachmentAssetId?: string;
    stickerId?: string;
  }) => Promise<DirectMessage>;
};
