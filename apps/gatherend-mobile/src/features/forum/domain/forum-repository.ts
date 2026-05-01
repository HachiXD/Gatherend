import type {
  EditedPost,
  ForumPost,
  ForumPostComment,
  ForumPostCommentsResult,
  ForumPostsPage,
} from "./post";

export type CreatePostInput = {
  boardId: string;
  title?: string | null;
  content?: string | null;
  imageAssetId?: string | null;
};

export type ForumRepository = {
  getBoardPosts: (boardId: string, cursor?: string | null) => Promise<ForumPostsPage>;
  getPostComments: (postId: string) => Promise<ForumPostCommentsResult>;
  createPost: (input: CreatePostInput) => Promise<ForumPost>;
  createComment: (input: {
    postId: string;
    content: string;
    imageAssetId?: string | null;
    replyToCommentId?: string | null;
  }) => Promise<ForumPostComment>;
  editPost: (postId: string, content: string) => Promise<EditedPost>;
  editComment: (postId: string, commentId: string, content: string) => Promise<ForumPostComment>;
  deletePost: (postId: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
};
