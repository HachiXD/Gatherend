import { forumRepository } from "../data/forum-repository";

export function editComment(postId: string, commentId: string, content: string) {
  return forumRepository.editComment(postId, commentId, content);
}
