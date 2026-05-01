import { conversationsRepository } from "../data/conversations-repository";

export function getConversations() {
  return conversationsRepository.listConversations();
}
