import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

interface CloneStickerParams {
  stickerId: string;
  profileId: string;
}

export const useCloneSticker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stickerId, profileId }: CloneStickerParams) => {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers/${stickerId}/clone`,
        {},
        getExpressAxiosConfig(profileId)
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate stickers query to refetch
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
      toast.success("Sticker added to your collection!");
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError<{ message?: string }>(error) &&
        error.response?.data?.message
          ? error.response.data.message
          : "Failed to add sticker";
      toast.error(message);
    },
  });
};

