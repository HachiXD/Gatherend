import { conversationsRepository } from "../data/conversations-repository";

export function sendDirectMessage(input: {
  conversationId: string;
  content: string;
  profileId: string;
  tempId: string;
  attachmentAssetId?: string;
  stickerId?: string;
}) {
  return conversationsRepository.sendDirectMessage(input);
}
