import { forumRepository } from "../data/forum-repository";

export function getBoardPosts(boardId: string, cursor?: string | null) {
  return forumRepository.getBoardPosts(boardId, cursor);
}
