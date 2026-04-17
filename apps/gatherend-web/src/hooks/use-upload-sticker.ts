"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { logger } from "@/lib/logger";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

interface UploadStickerVariables {
  formData: FormData;
  profileId: string;
}

export const useUploadSticker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formData, profileId }: UploadStickerVariables) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        logger.error("[useUploadSticker] NEXT_PUBLIC_API_URL is not defined!");
        throw new Error("API URL not configured");
      }

      const response = await axios.post(`${apiUrl}/stickers`, formData, {
        ...getExpressAxiosConfig(profileId, {
          "Content-Type": "multipart/form-data",
        }),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
    },
  });
};

interface DeleteStickerVariables {
  stickerId: string;
  profileId: string;
}

export const useDeleteSticker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stickerId, profileId }: DeleteStickerVariables) => {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers/${stickerId}`,
        getExpressAxiosConfig(profileId)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
    },
  });
};

