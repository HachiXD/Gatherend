import { useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface MentionableChannelMember {
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
  return useQuery<MentionableChannelMember[]>({
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

      return (await res.json()) as MentionableChannelMember[];
    },
    enabled: enabled && Boolean(boardId) && Boolean(channelId),
    staleTime: 1000 * 60,
  });
}
