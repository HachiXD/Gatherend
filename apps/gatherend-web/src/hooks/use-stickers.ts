"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";
import type { ClientSticker } from "@/types/uploaded-assets";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const useStickers = (profileId?: string) => {
  const getToken = useTokenGetter();

  return useQuery({
    queryKey: ["stickers", profileId],
    queryFn: async () => {
      const token = IS_PRODUCTION ? await getToken() : undefined;
      const config = profileId ? getExpressAxiosConfig(profileId, token) : {};
      const response = await axios.get<ClientSticker[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers`,
        config,
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
};
