import { forumRepository } from "../data/forum-repository";

export function getPost(boardId: string, postId: string) {
  return forumRepository.getPost(boardId, postId);
}
