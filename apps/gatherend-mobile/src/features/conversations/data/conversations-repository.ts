import type { ConversationRepository } from "../domain/conversation-repository";
import { createConversationsHttpDataSource } from "./conversations-http-datasource";

const conversationsHttpDataSource = createConversationsHttpDataSource();

export const conversationsRepository: ConversationRepository = {
  getConversation(conversationId, profileId) {
    return conversationsHttpDataSource.getConversation(conversationId, profileId);
  },
  getDirectMessages(input) {
    return conversationsHttpDataSource.getDirectMessages(input);
  },
  hideConversation(conversationId) {
    return conversationsHttpDataSource.hideConversation(conversationId);
  },
  listConversations() {
    return conversationsHttpDataSource.listConversations();
  },
  sendDirectMessage(input) {
    return conversationsHttpDataSource.sendDirectMessage(input);
  },
};
