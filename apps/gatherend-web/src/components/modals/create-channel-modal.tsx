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
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlashSVG } from "@/lib/slash";
import { useTranslation } from "@/i18n";
import type {
  BoardWithData,
  BoardChannel,
} from "@/components/providers/board-provider";

export const CreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "createChannel";
  const { board, boardId: dataBoardId, categoryId } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  const formSchema = z.object({
    name: z.string().min(1, {
      message: t.modals.createChannel.nameRequired,
    }),
    type: z.nativeEnum(ChannelType),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
    },
  });

  //  MUTATION con TanStack Query  //
  const createChannelMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await axios.post(`/api/boards/${boardId}/channels`, {
        ...values,
        categoryId: categoryId ?? null,
      });

      return response.data as BoardChannel;
    },
    onMutate: async (values) => {
      if (!boardId) return;

      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      // Snapshot del estado anterior
      const previousBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        boardId,
      ]);

      // Crear canal optimista
      const tempId = `temp-${Date.now()}`;
      const optimisticChannel: BoardChannel = {
        id: tempId,
        name: values.name,
        type: values.type,
        boardId: boardId,
        parentId: categoryId ?? null,
        position: 999, // Se corregirá cuando la API responda
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Actualizar cache optimísticamente
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        if (categoryId) {
          // Agregar a categoría
          return {
            ...old,
            categories: old.categories.map((cat) =>
              cat.id === categoryId
                ? { ...cat, channels: [...cat.channels, optimisticChannel] }
                : cat,
            ),
          };
        } else {
          // Agregar como canal root
          return {
            ...old,
            channels: [...old.channels, optimisticChannel],
          };
        }
      });

      return { previousBoard, tempId };
    },
    onSuccess: (newChannel, _variables, context) => {
      if (!boardId) return;

      // Reemplazar el canal optimista con el real
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old || !context?.tempId) return old;

        if (newChannel.parentId) {
          // Está en una categoría
          return {
            ...old,
            categories: old.categories.map((cat) =>
              cat.id === newChannel.parentId
                ? {
                    ...cat,
                    channels: cat.channels.map((ch) =>
                      ch.id === context.tempId ? newChannel : ch,
                    ),
                  }
                : cat,
            ),
          };
        } else {
          // Es un canal root
          return {
            ...old,
            channels: old.channels.map((ch) =>
              ch.id === context.tempId ? newChannel : ch,
            ),
          };
        }
      });

      toast.success(t.modals.createChannel.success);
      form.reset();
      onClose();
    },
    onError: (error, _variables, context) => {
      console.error(error);
      toast.error(t.modals.createChannel.error);

      // Rollback al estado anterior
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
