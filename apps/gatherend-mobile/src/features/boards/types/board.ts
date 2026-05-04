export type BoardImageAsset = {
  id: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  url: string;
};

export type UserBoardChannel = {
  id: string;
};

export type UserBoard = {
  id: string;
  name: string;
  imageAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  channels: UserBoardChannel[];
};

export type BoardChannelType = "TEXT" | "VOICE";

export type BoardChannel = {
  id: string;
  name: string;
  type: BoardChannelType;
  position: number;
  boardId: string;
  imageAsset: BoardImageAsset | null;
  channelMemberCount: number;
  isJoined: boolean;
  lastMessageAt: string | null;
};

export type BoardCurrentMember = {
  id: string;
  role: string;
  profileId: string;
  boardId: string;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
};

export type BoardTabNames = {
  home?: string | null;
  chats?: string | null;
  forum?: string | null;
  rules?: string | null;
  wiki?: string | null;
  ranking?: string | null;
  members?: string | null;
  invite?: string | null;
};

export type BoardWithData = {
  id: string;
  name: string;
  description: string | null;
  imageAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  channels: BoardChannel[];
  currentMember: BoardCurrentMember | null;
  memberCount: number;
  inviteCode: string;
  inviteEnabled: boolean;
  tabNames: BoardTabNames | null;
};

export type CreateBoardInput = {
  name: string;
  description?: string;
  imageAssetId?: string | null;
  bannerAssetId?: string | null;
  isPrivate: boolean;
};

export type CreatedBoard = {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  imageAsset: BoardImageAsset | null;
  bannerAsset: BoardImageAsset | null;
  channels: UserBoardChannel[];
};
