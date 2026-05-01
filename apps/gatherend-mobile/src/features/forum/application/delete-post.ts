import { forumRepository } from "../data/forum-repository";

export function deletePost(postId: string) {
  return forumRepository.deletePost(postId);
}
