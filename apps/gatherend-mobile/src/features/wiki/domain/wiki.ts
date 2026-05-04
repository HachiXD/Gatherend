import type { ClientPublicAsset } from "@/src/features/chat/types";

export type WikiPageAuthor = {
  id: string;
  username: string;
  discriminator: string | null;
  badge: string | null;
  avatarAsset: ClientPublicAsset | null;
};

export type WikiPagePreview = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: WikiPageAuthor;
};

export type WikiPagePreviewsPage = {
  items: WikiPagePreview[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type WikiPage = {
  id: string;
  title: string;
  content: string;
  imageAsset: ClientPublicAsset | null;
  createdAt: string;
  updatedAt: string;
  author: WikiPageAuthor;
};

export type CreateWikiPageInput = {
  boardId: string;
  title: string;
  content?: string | null;
  imageAssetId?: string | null;
};

export type EditWikiPageInput = {
  title?: string;
  content?: string;
  imageAssetId?: string | null;
};
