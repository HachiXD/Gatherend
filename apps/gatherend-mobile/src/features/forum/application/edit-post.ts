import { forumRepository } from "../data/forum-repository";

export function editPost(postId: string, content: string) {
  return forumRepository.editPost(postId, content);
}
