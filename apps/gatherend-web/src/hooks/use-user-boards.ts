"use client";

import { useQuery } from "@tanstack/react-query";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface UserBoard {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  channels: { id: string }[];
  mainChannelId: string | null;
}

export function useUserBoards() {
  return useQuery<UserBoard[]>({
    queryKey: ["user-boards"],
    queryFn: async () => {
      const response = await fetch("/api/boards", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch boards");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
