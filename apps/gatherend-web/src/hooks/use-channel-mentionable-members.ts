import { useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface MentionableBoardMember {
  profileId: string;
  profile: {
    id: string;
    username: string;
    discriminator: string;
    avatarAsset: ClientUploadedAsset | null;
  };
}

export function useChannelMentionableMembers(
  boardId: string | undefined,
  channelId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery<MentionableBoardMember[]>({
    queryKey: ["channel-mentionable-members", boardId, channelId],
    queryFn: async () => {
      const res = await fetch(
        `/api/boards/${boardId}/channels/${channelId}/mentionable-members`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch mentionable members");
      }

      return (await res.json()) as MentionableBoardMember[];
    },
    enabled: enabled && Boolean(boardId) && Boolean(channelId),
    staleTime: 1000 * 60,
  });
}
