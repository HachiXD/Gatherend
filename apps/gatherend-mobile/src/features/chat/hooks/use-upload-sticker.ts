import { useMutation, useQueryClient } from "@tanstack/react-query";
import { expressFetch } from "@/src/services/express/express-fetch";
import { STICKERS_QUERY_KEY } from "./use-stickers";

export function useUploadSticker(profileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await expressFetch("/stickers", {
        method: "POST",
        profileId,
        body: formData,
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Upload failed" }));
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "No se pudo subir el sticker",
        );
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
    },
  });
}

export function useDeleteSticker(profileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stickerId: string) => {
      const response = await expressFetch(`/stickers/${stickerId}`, {
        method: "DELETE",
        profileId,
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el sticker");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
    },
  });
}
