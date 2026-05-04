import type { ForumRepository } from "../domain/forum-repository";
import { createForumHttpDataSource } from "./forum-http-datasource";

const forumHttpDataSource = createForumHttpDataSource();

export const forumRepository: ForumRepository = {
  getBoardPosts: (boardId, cursor) =>
    forumHttpDataSource.getBoardPosts(boardId, cursor),
  getBoardPostPreviews: (boardId, cursor) =>
    forumHttpDataSource.getBoardPostPreviews(boardId, cursor),
  getPost: (boardId, postId) =>
    forumHttpDataSource.getPost(boardId, postId),
  getPostComments: (postId) =>
    forumHttpDataSource.getPostComments(postId),
  createPost: (input) =>
    forumHttpDataSource.createPost(input),
  createComment: (input) =>
    forumHttpDataSource.createComment(input),
  editPost: (postId, content) =>
    forumHttpDataSource.editPost(postId, content),
  editComment: (postId, commentId, content) =>
    forumHttpDataSource.editComment(postId, commentId, content),
  deletePost: (postId) =>
    forumHttpDataSource.deletePost(postId),
  deleteComment: (postId, commentId) =>
    forumHttpDataSource.deleteComment(postId, commentId),
};
