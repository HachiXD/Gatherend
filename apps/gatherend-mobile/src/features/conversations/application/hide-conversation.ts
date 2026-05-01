import { conversationsRepository } from "../data/conversations-repository";

export function hideConversation(conversationId: string) {
  return conversationsRepository.hideConversation(conversationId);
}
