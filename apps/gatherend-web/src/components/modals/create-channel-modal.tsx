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

function getOptimisticChannelMemberCount(
  board: BoardWithData | undefined,
) {
  const autoJoinedProfileIds = new Set<string>();

  board?.members.forEach((member) => {
    if (
      member.profileId &&
      (member.role === MemberRole.OWNER ||
        member.role === MemberRole.ADMIN ||
        member.role === MemberRole.MODERATOR)
    ) {
      autoJoinedProfileIds.add(member.profileId);
    }
  });

  return autoJoinedProfileIds.size;
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
        className="max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.createChannel.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.modals.createChannel.nameLabel}
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
                        htmlFor="create-channel-name"
                        className="uppercase text-[15px] font-bold text-theme-text-subtle -mb-1.5"
                      >
                        {t.modals.createChannel.nameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="create-channel-name"
                          disabled={isLoading}
                          className="rounded-none border border-theme-border bg-theme-bg-edit-form/60 h-8 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder={t.modals.createChannel.namePlaceholder}
                          autoComplete="off"
                          {...field}
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
                        id="create-channel-type-label"
                        className="block uppercase text-[15px] font-bold text-theme-text-subtle -mt-1"
                      >
                        {t.modals.createChannel.typeLabel}
                      </span>
                      <FormControl>
                        <div
                          className="flex justify-center gap-3 -mt-1.5"
                          role="group"
                          aria-labelledby="create-channel-type-label"
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
                            <span>{t.modals.createChannel.text}</span>
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
                            <span>{t.modals.createChannel.voice}</span>
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
              <div className="flex items-center justify-end gap-2 w-full">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={handleClose}
                  variant="ghost"
                  className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  className="h-6.5 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
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
