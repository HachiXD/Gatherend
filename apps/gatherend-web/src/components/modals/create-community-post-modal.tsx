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
      <DialogContent
        className="max-w-2xl! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            Crear post
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] -mt-2 text-theme-text-subtle">
            Publica contenido permanente en {communityName}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2 -mt-5 px-6">
              <FormField
                control={form.control}
                name="imageUpload"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-[15px] -mb-1.5 font-bold text-theme-text-subtle">
                      Imagen (opcional)
                    </FormLabel>
                    <FormControl>
                      <div className="border border-theme-border bg-theme-bg-edit-form/60 px-3 py-1.5">
                        <FileUpload
                          endpoint="communityPostImage"
                          value={field.value || ""}
                          onChange={field.onChange}
                          uploadButtonClassName="h-7 w-auto flex-row gap-1 rounded-none border-theme-border-subtle border-solid bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                          imagePreviewWrapperClassName="relative mt-0 inline-flex h-[112px] w-full items-start gap-2 overflow-hidden border border-theme-border bg-theme-bg-secondary/40 p-2"
                          imagePreviewClassName="h-full max-h-full w-auto -mr-1.5 max-w-[calc(100%-24px)] rounded-none object-contain"
                          removeButtonClassName="static bg-transparent cursor-pointer py-0 pr-4.5 pl-0 text-theme-text-tertiary shadow-none hover:bg-transparent hover:text-theme-text-light"
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
                      className="uppercase text-[15px] -mb-1.5 font-bold text-theme-text-subtle"
                    >
                      Contenido
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="community-post-content"
                        className="scrollbar-ultra-thin h-[160px] resize-none overflow-y-auto rounded-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[12px] leading-5 text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                        maxLength={2000}
                        placeholder="Escribe tu post..."
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between gap-3 -mt-1 -mb-4.5">
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

            <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5">
              <Button
                type="button"
                variant="ghost"
                className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                onClick={handleClose}
                disabled={createPostMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
                className="h-6.5 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
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
