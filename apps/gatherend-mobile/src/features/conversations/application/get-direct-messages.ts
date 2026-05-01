import { conversationsRepository } from "../data/conversations-repository";

export function getDirectMessages(input: {
  conversationId: string;
  cursor?: string;
  direction?: "before" | "after";
  profileId: string;
}) {
  return conversationsRepository.getDirectMessages(input);
}
