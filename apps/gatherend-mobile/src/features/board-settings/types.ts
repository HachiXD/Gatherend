import type { BoardImageAsset, BoardWithData } from "@/src/features/boards/types/board";
import type { MemberRole } from "../boards/member-role";

export type { MemberRole as BoardMemberRole } from "../boards/member-role";

export type BoardSettingsTabId =
  | "general"
  | "members"
  | "bans"
  | "history"
  | "danger";

export type BoardSettingsSection = {
  id: BoardSettingsTabId;
  title: string;
  description: string;
  icon: string;
  route: string;
};

export type BoardSettingsUpdatedBoard = Pick<
  BoardWithData,
  | "id"
  | "name"
  | "description"
  | "imageAsset"
  | "bannerAsset"
  | "inviteCode"
  | "inviteEnabled"
>;

export type BoardSettingsMemberProfile = {
  id: string;
  username: string;
  discriminator: string;
  avatarAsset: BoardImageAsset | null;
};

export type BoardSettingsMember = {
  id: string;
  role: MemberRole;
  profileId: string;
  boardId: string;
  xp: number;
  level: number;
  activeWarningCount: number;
  latestActiveWarningId: string | null;
  profile: BoardSettingsMemberProfile;
};

export type BoardMembersPage = {
  items: BoardSettingsMember[];
  members: BoardSettingsMember[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type BoardBanSourceType = "MANUAL" | "WARNING_THRESHOLD";

export type BoardBannedUser = {
  id: string;
  profileId: string;
  createdAt: string;
  sourceType: BoardBanSourceType;
  issuedBy: BoardSettingsMemberProfile;
  profile: BoardSettingsMemberProfile;
};

export type BoardBansPage = {
  items: BoardBannedUser[];
  bans: BoardBannedUser[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type BoardModerationActionType =
  | "WARNING"
  | "REMOVE_WARNING"
  | "BAN"
  | "UNBAN"
  | "KICK"
  | "AUTO_BAN"
  | "AUTO_UNBAN";

export type BoardModerationActionItem = {
  id: string;
  actionType: BoardModerationActionType;
  createdAt: string;
  profile: BoardSettingsMemberProfile;
  issuedBy: BoardSettingsMemberProfile;
  warning: {
    id: string;
    status: string;
    removedAt: string | null;
    promotedToBanId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  ban: {
    id: string;
    sourceType: string;
    createdAt: string;
  } | null;
};

export type BoardModerationActionsPage = {
  items: BoardModerationActionItem[];
  actions: BoardModerationActionItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
