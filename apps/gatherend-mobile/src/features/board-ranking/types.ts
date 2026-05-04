import type { BoardImageAsset } from "@/src/features/boards/types/board";

export type BoardRankingMemberProfile = {
  id: string;
  username: string;
  discriminator: string;
  avatarAsset: BoardImageAsset | null;
};

export type BoardRankingMember = {
  id: string;
  profileId: string;
  xp: number;
  level: number;
  rank: number;
  profile: BoardRankingMemberProfile;
};

export type BoardRankingPage = {
  items: BoardRankingMember[];
  nextCursor: string | null;
  hasMore: boolean;
};
