import type { ForumPostPreview } from "@/src/features/forum/domain/post";

export type FeaturedChannel = {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  memberCount: number;
  imageAsset: { url: string } | null;
};

export type FeaturedData = {
  topPosts: ForumPostPreview[];
  topChannels: FeaturedChannel[];
};
