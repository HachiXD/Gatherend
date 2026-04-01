"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { ChannelType } from "@prisma/client";
import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlashSVG } from "@/lib/slash";
import { FileUpload } from "@/components/file-upload";
import {
  getStoredUploadAssetId,
  parseStoredUploadValue,
} from "@/lib/upload-values";
import type {
  BoardWithData,
  BoardChannel,
} from "@/components/providers/board-provider";
import { useTranslation } from "@/i18n";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const PANEL_SHELL =
  "border border-theme-border bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]";

function getOptimisticChannelImageAsset(
  value: string | null | undefined,
): ClientUploadedAsset | null {
  const upload = parseStoredUploadValue(value);
  if (!upload) {
    return null;
  }

  return {
    id: upload.assetId,
    url: upload.url,
    width: upload.width ?? null,
    height: upload.height ?? null,
    dominantColor: null,
  };
}

function getStoredUploadValueFromAsset(
  asset: ClientUploadedAsset | null | undefined,
): string {
  if (!asset?.id || !asset.url) {
    return "";
  }

  return JSON.stringify({
    assetId: asset.id,
    url: asset.url,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  });
}

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Room name is required",
  }),
  type: z.enum(ChannelType),
  imageUpload: z.string().optional(),
});

export const EditChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "editChannel";
  const { channel: rawChannel, board, boardId: dataBoardId } = data;
  const channel = rawChannel as BoardChannel | undefined;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
      imageUpload: "",
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (channel && isModalOpen) {
      form.reset({
        name: channel.name || "",
        type: channel.type || ChannelType.TEXT,
        imageUpload: getStoredUploadValueFromAsset(channel.imageAsset),
      });

      // Posicionar cursor al final del texto
      setTimeout(() => {
        if (inputRef.current) {
          const length = inputRef.current.value.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    }
  }, [form, channel, isModalOpen]);

  //  MUTATION con TanStack Query  //
  const editChannelMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const payload: Partial<z.infer<typeof formSchema>> & {
        imageAssetId?: string | null;
      } = {
        name: values.name,
      };

      if (channel?.type !== values.type) {
        payload.type = values.type;
      }

      const assetId = getStoredUploadAssetId(values.imageUpload);
      if (assetId !== (channel?.imageAsset?.id ?? null)) {
        payload.imageAssetId = assetId;
      }

      const response = await axios.patch(
        `/api/boards/${boardId}/channels/${channel?.id}`,
        payload,
      );
      return response.data as BoardChannel;
    },
    onMutate: async (values) => {
      if (!boardId || !channel?.id) return;

      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      const previousBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        boardId,
      ]);

      const nextImageAssetId = getStoredUploadAssetId(values.imageUpload);
      const imageWasChanged =
        nextImageAssetId !== (channel.imageAsset?.id ?? null);
      const optimisticImageAsset = imageWasChanged
        ? getOptimisticChannelImageAsset(values.imageUpload)
        : channel.imageAsset;

      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        return {
          ...old,
          channels: old.channels.map((ch) =>
            ch.id === channel.id
              ? {
                  ...ch,
                  name: values.name,
                  type: values.type,
                  imageAsset: optimisticImageAsset,
                }
              : ch,
          ),
        };
      });

      return { previousBoard };
    },
    onSuccess: (updatedChannel) => {
      if (!boardId) return;

      // Sincronizar con la respuesta del servidor
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        return {
          ...old,
          channels: old.channels.map((ch) =>
            ch.id === updatedChannel.id ? updatedChannel : ch,
          ),
        };
      });

      toast.success(t.modals.editChannel.success);
      form.reset();
      onClose();
    },
    onError: (error, _variables, context) => {
      console.error(error);
      toast.error(t.modals.editChannel.error);

      // Rollback al estado anterior
      if (context?.previousBoard && boardId) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
    },
  });

  const isLoading = editChannelMutation.isPending;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editChannelMutation.mutate(values);
  };

  const handleClose = () => {
    if (isLoading) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.editChannel.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.modals.editChannel.nameLabel}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-6 pb-4 -mt-2.5">
              <div className="space-y-3 bg-theme-bg-modal px-3 py-2 -mt-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="edit-channel-name"
                        className="uppercase text-[15px] font-bold text-theme-text-subtle -mb-1.5"
                      >
                        {t.modals.editChannel.nameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="edit-channel-name"
                          disabled={isLoading}
                          className="rounded-none border border-theme-border bg-theme-bg-edit-form/60 h-8 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder={t.modals.editChannel.namePlaceholder}
                          autoComplete="off"
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            inputRef.current = e;
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className={cn("p-3", PANEL_SHELL)}>
                  <div className="uppercase text-[15px] font-bold text-theme-text-subtle mb-2">
                    Imagen (opcional)
                  </div>
                  <div className="flex items-center justify-center text-center">
                    <FormField
                      control={form.control}
                      name="imageUpload"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <FileUpload
                              endpoint="channelImage"
                              value={field.value || ""}
                              onChange={field.onChange}
                              uploadButtonClassName="rounded-none border-theme-border-subtle bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                              label="Sube una imagen para este room"
                            />
                          </FormControl>
                          <FormMessage className="-mt-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <span
                        id="edit-channel-type-label"
                        className="block uppercase text-[15px] font-bold text-theme-text-subtle -mt-1"
                      >
                        {t.modals.editChannel.typeLabel}
                      </span>
                      <FormControl>
                        <div
                          className="flex justify-center gap-3 -mt-1.5"
                          role="group"
                          aria-labelledby="edit-channel-type-label"
                        >
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => field.onChange(ChannelType.TEXT)}
                            className={cn(
                              "flex h-8 w-32 cursor-pointer items-center justify-center gap-1.5 rounded-none border px-3 text-[14px] transition",
                              field.value === ChannelType.TEXT
                                ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                                : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                            )}
                          >
                            <SlashSVG className="h-5 w-5 -mr-1.5" />
                            <span>{t.modals.editChannel.text}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => field.onChange(ChannelType.VOICE)}
                            className={cn(
                              "flex h-8 w-32 cursor-pointer items-center justify-center gap-1.5 rounded-none border px-3 text-[14px] transition",
                              field.value === ChannelType.VOICE
                                ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                                : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                            )}
                          >
                            <Mic className="h-5 w-5 -mr-1" />
                            <span>{t.modals.editChannel.voice}</span>
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5 -mt-3">
              <Button
                type="button"
                variant="ghost"
                disabled={isLoading}
                onClick={handleClose}
                className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                className="h-6.5 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading}
              >
                {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
