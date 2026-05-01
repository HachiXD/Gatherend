import type { CreatePostInput } from "../domain/forum-repository";
import { forumRepository } from "../data/forum-repository";

export function createPost(input: CreatePostInput) {
  return forumRepository.createPost(input);
}
