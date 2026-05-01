import { conversationsRepository } from "../data/conversations-repository";

export function getConversation(conversationId: string, profileId: string) {
  return conversationsRepository.getConversation(conversationId, profileId);
}
