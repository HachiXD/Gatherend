import type { ForumPostPreview } from "@/src/features/forum/domain/post";

export type FeaturedChannel = {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  memberCount: number;
  lastMessageAt: string | null;
  imageAsset: { url: string; dominantColor: string | null } | null;
};

export type FeaturedData = {
  topPosts: ForumPostPreview[];
  topChannels: FeaturedChannel[];
};
