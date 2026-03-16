import {
  serializeProfileSummary,
  uploadedAssetSummarySelect,
} from "@/lib/uploaded-assets";

export const moderationProfileSelect = {
  id: true,
  username: true,
  discriminator: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  usernameFormat: true,
  avatarAsset: {
    select: uploadedAssetSummarySelect,
  },
  badgeSticker: {
    select: {
      id: true,
      asset: {
        select: uploadedAssetSummarySelect,
      },
    },
  },
} as const;

export const moderationProfileWithUserIdSelect = {
  ...moderationProfileSelect,
  userId: true,
} as const;

export function serializeModerationProfile<
  T extends Parameters<typeof serializeProfileSummary>[0],
>(profile: T | null) {
  return profile ? serializeProfileSummary(profile) : null;
}
