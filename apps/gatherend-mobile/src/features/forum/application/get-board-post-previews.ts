import { forumRepository } from "../data/forum-repository";

export function getBoardPostPreviews(
  boardId: string,
  cursor?: string | null,
  channelId?: string | null,
) {
  return forumRepository.getBoardPostPreviews(boardId, cursor, channelId);
}
