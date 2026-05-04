import type { ClientPublicAsset, ClientStickerAssetRef } from "@/src/features/chat/types";

export type ForumPostAuthor = {
  id: string;
  username: string;
  discriminator: string | null;
  usernameColor: unknown;
  usernameFormat: unknown;
  badge: string | null;
  avatarAsset: ClientPublicAsset | null;
  badgeSticker: ClientStickerAssetRef | null;
};

export type ForumPostComment = {
  id: string;
  postId: string;
  content: string;
  deleted: boolean;
  imageAsset: ClientPublicAsset | null;
  createdAt: string;
  updatedAt: string;
  author: ForumPostAuthor;
  replyToCommentId: string | null;
  replyToComment: {
    id: string;
    content: string;
    deleted: boolean;
    createdAt: string;
    author: {
      id: string;
      username: string;
      discriminator: string | null;
    };
  } | null;
};

export type ForumPost = {
  id: string;
  title: string | null;
  content: string;
  imageAsset: ClientPublicAsset | null;
  commentCount: number;
  latestComments: ForumPostComment[];
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: ForumPostAuthor;
};

export type ForumPostsPage = {
  items: ForumPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ForumPostCommentsResult = {
  items: ForumPostComment[];
  totalCount: number;
};

export type ForumPostPreview = {
  id: string;
  title: string | null;
  contentSnippet: string;
  imageAsset: ClientPublicAsset | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  lockedAt: string | null;
  author: ForumPostAuthor;
};

export type ForumPostPreviewsPage = {
  items: ForumPostPreview[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type EditedPost = {
  id: string;
  content: string;
  updatedAt: string;
};
