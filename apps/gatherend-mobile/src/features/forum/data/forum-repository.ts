import type { ForumRepository } from "../domain/forum-repository";
import { createForumHttpDataSource } from "./forum-http-datasource";

const forumHttpDataSource = createForumHttpDataSource();

export const forumRepository: ForumRepository = {
  getBoardPosts: (boardId, cursor, channelId) =>
    forumHttpDataSource.getBoardPosts(boardId, cursor, channelId),
  getBoardPostPreviews: (boardId, cursor, channelId) =>
    forumHttpDataSource.getBoardPostPreviews(boardId, cursor, channelId),
  getPost: (boardId, postId, channelId) =>
    forumHttpDataSource.getPost(boardId, postId, channelId),
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
