import { forumRepository } from "../data/forum-repository";

export function getPostComments(postId: string) {
  return forumRepository.getPostComments(postId);
}
