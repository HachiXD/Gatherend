"use client";

import axios, { AxiosError } from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/file-upload";
import { useModal } from "@/hooks/use-modal-store";
import { communityPostsKey } from "@/hooks/discovery/posts-feed/use-community-posts-feed";
import { communityOverviewKey } from "@/hooks/discovery/use-community-overview";
import { getStoredUploadAssetId } from "@/lib/upload-values";

const schema = z.object({
  content: z
    .string()
    .trim()
    .max(2000, { message: "El contenido no puede exceder 2000 caracteres" }),
  imageUpload: z.string().optional(),
});

type FormSchema = z.infer<typeof schema>;

const DEFAULTS: FormSchema = {
  content: "",
  imageUpload: "",
};

export const CreateCommunityPostModal = () => {
  const queryClient = useQueryClient();
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "createCommunityPost";
  const communityId = data.communityId;
  const communityName = data.communityName || "esta comunidad";

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (isModalOpen) {
      form.reset(DEFAULTS);
    }
  }, [form, isModalOpen]);

  const content = useWatch({
    control: form.control,
    name: "content",
    defaultValue: "",
  });

  const createPostMutation = useMutation({
    mutationFn: async (values: FormSchema) => {
      if (!communityId) {
        throw new Error("Missing community ID");
      }

      const response = await axios.post("/api/posts", {
        communityId,
        content: values.content,
        imageAssetId: getStoredUploadAssetId(values.imageUpload),
      });

      return response.data;
    },
    onSuccess: async () => {
      if (communityId) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: communityPostsKey(communityId),
          }),
          queryClient.invalidateQueries({
            queryKey: communityOverviewKey(communityId),
          }),
        ]);
      }

      toast.success("Post publicado");
      form.reset(DEFAULTS);
      onClose();
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "No se pudo publicar el post";

      toast.error(message);
    },
  });

  const onSubmit = (values: FormSchema) => {
    createPostMutation.mutate(values);
  };

  const handleClose = () => {
    if (createPostMutation.isPending) return;
    form.reset(DEFAULTS);
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-theme-bg-modal max-w-2xl! text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Crear post
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-subtle">
            Publica contenido permanente en {communityName}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="space-y-5 px-6">
              <FormField
                control={form.control}
                name="imageUpload"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[15px] font-bold text-theme-text-subtle">
                      Imagen (opcional)
                    </FormLabel>
                    <FormControl>
                      <div className="rounded-xl border border-dashed border-theme-border-primary bg-theme-bg-secondary/60 p-4">
                        <FileUpload
                          endpoint="communityPostImage"
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      htmlFor="community-post-content"
                      className="uppercase text-[15px] font-bold text-theme-text-subtle"
                    >
                      Contenido
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="community-post-content"
                        className="min-h-[160px] resize-none border-0 bg-theme-bg-input-modal text-[15px] text-theme-text-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                        maxLength={2000}
                        placeholder="Escribe tu post..."
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-theme-text-tertiary">
                        M&aacute;ximo 2000 caracteres.
                      </p>
                      <span className="text-xs text-theme-text-tertiary">
                        {content.length}/2000
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="bg-theme-bg-secondary px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer bg-theme-bg-cancel-button text-theme-text-light hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                onClick={handleClose}
                disabled={createPostMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
                className="bg-theme-button-primary text-white hover:bg-theme-button-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createPostMutation.isPending ? "Publicando..." : "Publicar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
