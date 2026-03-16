import { Board, Member } from "@prisma/client";
import type {
  ClientStickerAssetRef,
  ClientUploadedAsset,
} from "./src/types/uploaded-assets";

// Username format type - supports multiple style combinations
export type UsernameFormatConfig = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

// Username color types - supports solid colors and animated gradients
export type UsernameColorSolid = {
  type: "solid";
  color: string; // Hex color e.g., "#FF5733"
};

export type GradientColorStop = {
  color: string; // Hex color
  position: number; // 0-100 percentage
};

export type UsernameColorGradient = {
  type: "gradient";
  colors: GradientColorStop[]; // Array of color stops, min 2, max 4
  angle: number; // Gradient angle in degrees (0-360)
  animated?: boolean; // Whether to animate on hover
  animationType?: "shift" | "shimmer" | "pulse"; // Animation style
};

export type UsernameColor = UsernameColorSolid | UsernameColorGradient | null;

// Profile tag type - short text tags for profile
export type ProfileTag = string; // Max 10 chars each, max 10 tags total

export type BoardWithMembersWithProfiles = Board & {
  members: (Member & {
    profile: {
      id: string;
      username: string;
      discriminator: string;
      usernameColor: UsernameColor;
      profileTags: string[];
      badge: string | null;
      avatarAsset: ClientUploadedAsset | null;
      badgeSticker: ClientStickerAssetRef | null;
      usernameFormat: UsernameFormatConfig | null;
      longDescription: string | null;
    };
  })[];
};
