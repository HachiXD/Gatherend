import { forumRepository } from "../data/forum-repository";

export function deleteComment(postId: string, commentId: string) {
  return forumRepository.deleteComment(postId, commentId);
}
