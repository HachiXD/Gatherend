import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateProfile,
  type ProfileUpdatePayload,
} from "@/src/features/profile/api/update-profile";
import { applyProfilePatchToAllMobileCaches } from "@/src/features/profile/utils/profile-patch-utils";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<ClientProfile, Error, ProfileUpdatePayload>({
    mutationFn: updateProfile,
    onSuccess: (serverProfile) => {
      // Full replace of the current-profile cache with the server response
      queryClient.setQueryData<ClientProfile>(
        ["current-profile"],
        (old) => (old ? { ...old, ...serverProfile } : serverProfile),
      );

      // Propagate the visible fields to all other caches (chat, conversations)
      applyProfilePatchToAllMobileCaches(queryClient, serverProfile.id, {
        username: serverProfile.username,
        discriminator: serverProfile.discriminator,
        avatarAsset: serverProfile.avatarAsset,
        bannerAsset: serverProfile.bannerAsset,
        chatBubbleStyle: serverProfile.chatBubbleStyle,
        usernameColor: serverProfile.usernameColor,
        usernameFormat: serverProfile.usernameFormat,
        profileTags: serverProfile.profileTags,
        badge: serverProfile.badge,
        badgeSticker: serverProfile.badgeSticker,
      });

      // Invalidate downstream queries that embed profile data
      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
