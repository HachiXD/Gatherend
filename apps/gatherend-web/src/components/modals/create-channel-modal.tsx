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
import { ChannelType, MemberRole } from "@prisma/client";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlashSVG } from "@/lib/slash";
import { useTranslation } from "@/i18n";
import { FileUpload } from "@/components/file-upload";
import {
  getStoredUploadAssetId,
  parseStoredUploadValue,
} from "@/lib/upload-values";
import type {
  BoardWithData,
  BoardChannel,
} from "@/components/providers/board-provider";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

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

function getOptimisticChannelMemberCount(board: BoardWithData | undefined) {
  const currentRole = board?.currentMember?.role;
  return currentRole === MemberRole.OWNER ||
    currentRole === MemberRole.ADMIN ||
    currentRole === MemberRole.MODERATOR
    ? 1
    : 0;
}

export const CreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "createChannel";
  const { board, boardId: dataBoardId } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  const formSchema = z.object({
    name: z.string().min(1, {
      message: t.modals.createChannel.nameRequired,
    }),
    type: z.nativeEnum(ChannelType),
    imageUpload: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
      imageUpload: "",
    },
  });

  //  MUTATION con TanStack Query  //
  const createChannelMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await axios.post(`/api/boards/${boardId}/channels`, {
        name: values.name,
        type: values.type,
        imageAssetId: getStoredUploadAssetId(values.imageUpload),
      });

      return response.data as BoardChannel;
    },
    onMutate: async (values) => {
      if (!boardId) return;

      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      const previousBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        boardId,
      ]);

      const tempId = `temp-${Date.now()}`;
      const optimisticImageAsset = getOptimisticChannelImageAsset(
        values.imageUpload,
      );
      const optimisticMemberCount = previousBoard
        ? getOptimisticChannelMemberCount(previousBoard)
        : 1;
      const optimisticChannel: BoardChannel = {
        id: tempId,
        name: values.name,
        type: values.type,
        boardId: boardId,
        position: 999,
        imageAsset: optimisticImageAsset,
        channelMemberCount: optimisticMemberCount,
        isJoined: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          channels: [...old.channels, optimisticChannel],
        };
      });

      return { previousBoard, tempId };
    },
    onSuccess: (newChannel, _variables, context) => {
      if (!boardId) return;

      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old || !context?.tempId) return old;
        return {
          ...old,
          channels: [
            ...old.channels.filter(
              (ch) => ch.id !== context.tempId && ch.id !== newChannel.id,
            ),
            newChannel,
          ],
        };
      });

      toast.success(t.modals.createChannel.success);
      form.reset();
      onClose();
    },
    onError: (error, _variables, context) => {
      console.error(error);
      toast.error(t.modals.createChannel.error);

      if (context?.previousBoard && boardId) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
    },
  });

  const isLoading = createChannelMutation.isPending;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createChannelMutation.mutate(values);
  };

  const handleClose = () => {
    if (isLoading) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[400px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-2 pb-0">
          <DialogTitle className="text-[22px] -mb-1 font-medium text-theme-text-primary">
            {t.modals.createChannel.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.modals.createChannel.nameLabel}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-5 pt-0 pb-4 flex flex-col gap-2.5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-0.5">
                    <FormLabel
                      htmlFor="create-channel-name"
                      className="text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle"
                    >
                      {t.modals.createChannel.nameLabel}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="create-channel-name"
                        disabled={isLoading}
                        className="h-9 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder={t.modals.createChannel.namePlaceholder}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px] leading-tight" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-0.5">
                    <FormLabel
                      id="create-channel-type-label"
                      className="text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle"
                    >
                      {t.modals.createChannel.typeLabel}
                    </FormLabel>
                    <FormControl>
                      <div
                        className="flex rounded-lg border border-theme-border bg-theme-bg-edit-form/60 p-1"
                        role="group"
                        aria-labelledby="create-channel-type-label"
                      >
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => field.onChange(ChannelType.TEXT)}
                          className={cn(
                            "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[14px] transition disabled:cursor-not-allowed disabled:opacity-70",
                            field.value === ChannelType.TEXT
                              ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                              : "bg-transparent text-theme-text-subtle hover:bg-theme-bg-secondary hover:text-theme-text-primary",
                          )}
                        >
                          <SlashSVG className="h-5 w-5 shrink-0" />
                          <span>{t.modals.createChannel.text}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => field.onChange(ChannelType.VOICE)}
                          className={cn(
                            "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[14px] transition disabled:cursor-not-allowed disabled:opacity-70",
                            field.value === ChannelType.VOICE
                              ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                              : "bg-transparent text-theme-text-subtle hover:bg-theme-bg-secondary hover:text-theme-text-primary",
                          )}
                        >
                          <Mic className="h-5 w-5 shrink-0" />
                          <span>{t.modals.createChannel.voice}</span>
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px] leading-tight" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUpload"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-0.5">
                    <FormLabel className="text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle">
                      Imagen (opcional)
                    </FormLabel>
                    <div className="rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-3">
                      <div className="flex items-center justify-center text-center">
                        <FormControl>
                          <FileUpload
                            endpoint="channelImage"
                            value={field.value || ""}
                            onChange={field.onChange}
                            uploadButtonClassName="h-24 w-[220px] transition-all max-w-full rounded-lg border-theme-border bg-theme-bg-secondary/40 text-theme-text-subtle hover:border-theme-border hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                            imagePreviewWrapperClassName="h-20 w-20"
                            imagePreviewClassName="h-20 w-20 rounded-lg border border-theme-border object-cover"
                            removeButtonClassName="rounded-full border border-theme-border bg-theme-bg-cancel-button p-1 text-theme-text-subtle transition hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                            label="Sube una imagen para este chat"
                          />
                        </FormControl>
                      </div>
                    </div>
                    <FormMessage className="text-[11px] leading-tight" />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="border-t border-theme-border px-5 py-1">
              <div className="flex w-full items-center justify-end gap-2">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={handleClose}
                  variant="ghost"
                  className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  className="h-6.5 cursor-pointer rounded-lg bg-theme-tab-button-bg px-4 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading}
                >
                  {t.modals.createChannel.create}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
