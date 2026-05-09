import type { BoardImageAsset } from "@/src/features/boards/types/board";

export type DiscoveryBoard = {
  id: string;
  name: string;
  imageAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  memberCount: number;
};

export type DiscoveryBoardsPage = {
  items: DiscoveryBoard[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type JoinBoardFromDiscoveryResponse = {
  alreadyMember?: boolean;
  targetChannelId?: string | null;
  redirectUrl?: string | null;
};
