import type { ForumPostPreview } from "@/src/features/forum/domain/post";

export type FeaturedPostsPage = {
  items: ForumPostPreview[];
  nextCursor: string | null;
  hasMore: boolean;
};
