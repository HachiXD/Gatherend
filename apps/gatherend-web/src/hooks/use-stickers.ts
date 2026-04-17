"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getExpressAxiosConfig } from "@/lib/express-fetch";
import type { ClientSticker } from "@/types/uploaded-assets";

export const useStickers = (profileId?: string) => {
  return useQuery({
    queryKey: ["stickers", profileId],
    queryFn: async () => {
      const config = profileId ? getExpressAxiosConfig(profileId) : {};
      const response = await axios.get<ClientSticker[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers`,
        config,
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
};
