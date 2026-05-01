import { forumRepository } from "../data/forum-repository";

export function createComment(input: {
  postId: string;
  content: string;
  imageAssetId?: string | null;
  replyToCommentId?: string | null;
}) {
  return forumRepository.createComment(input);
}
