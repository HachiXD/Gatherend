import { Board, ChannelType, Member } from "@prisma/client";
import type { UsernameColor, UsernameFormatConfig } from "../../../types";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "@/types/uploaded-assets";

export type BoardChannel = {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  boardId: string;
  imageAsset: ClientUploadedAsset | null;
  channelMemberCount: number;
  isJoined: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardMember = Member & {
  activeWarningCount: number;
  latestActiveWarningId: string | null;
  profile: {
    id: string;
    username: string;
    discriminator: string;
    avatarAsset: ClientUploadedAsset | null;
    usernameColor: UsernameColor;
    profileTags: string[];
    badge: string | null;
    badgeSticker: ClientStickerAssetRef | null;
    usernameFormat: UsernameFormatConfig | null;
  };
};

export type BoardCurrentMember = Pick<
  Member,
  "id" | "role" | "profileId" | "boardId" | "level" | "xp" | "createdAt" | "updatedAt"
>;

export type BoardWithData = Omit<Board, "memberCount"> & {
  imageAsset: ClientUploadedAsset | null;
  bannerAsset: ClientUploadedAsset | null;
  channels: BoardChannel[];
  currentMember: BoardCurrentMember | null;
  memberCount: number;
};
