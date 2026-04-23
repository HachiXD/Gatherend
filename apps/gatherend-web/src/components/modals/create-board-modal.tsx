"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useModal } from "@/hooks/use-modal-store";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useNavigationStore } from "@/hooks/use-navigation-store";
import { useTranslation } from "@/i18n";
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
import { FileUpload } from "@/components/file-upload";
import { Textarea } from "../ui/textarea";
import { detectBoardLanguages } from "@/lib/detect-language";
import { Globe, Lock } from "lucide-react";
import { getStoredUploadAssetId } from "@/lib/upload-values";

const schema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(50, { message: "El nombre no puede exceder 50 caracteres" }),
  description: z
    .string()
    .max(300, { message: "La descripción no puede exceder 300 caracteres" })
    .optional(),
  imageUpload: z.string().optional(),
  isPrivate: z.boolean(),
});

type FormSchema = z.infer<typeof schema>;

const DEFAULTS: FormSchema = {
  name: "",
  description: "",
  imageUpload: "",
  isPrivate: true,
};

const fieldLabelClassName =
  "text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle";

export const CreateBoardModal = () => {
  const { isOpen, onClose, type } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { switchBoard, isNavigationReady } = useNavigationStore();

  const isModalOpen = isOpen && type === "createBoard";
  const visibilityLabel = `${t.modals.createBoard.publicOptionLabel} / ${t.modals.createBoard.privateOptionLabel}`;

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (isModalOpen) {
      form.reset(DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const isPrivate = form.watch("isPrivate");

  const createBoardMutation = useMutation({
    mutationFn: async (values: FormSchema) => {
      const boardData = {
        name: values.name,
        description: values.description,
        isPrivate: values.isPrivate,
        imageAssetId: getStoredUploadAssetId(values.imageUpload),
        languages: detectBoardLanguages(),
      };
      const response = await axios.post("/api/boards", boardData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(t.modals.createBoard.success);
      form.reset(DEFAULTS);
      onClose();

      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["communities-feed"] });

      const boardId = data.id;
      if (isNavigationReady() && switchBoard) {
        switchBoard(boardId);
      } else {
        window.location.href = `/boards/${boardId}/rules`;
      }
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      console.error(error);

      if (error.response?.data?.error === "MODERATION_BLOCKED") {
        const message =
          error.response.data.message || "Content was blocked by moderation.";
        toast.error(message, {
          duration: 5000,
          description: t.modals.createBoard.moderationError,
        });
      } else {
        toast.error(t.modals.createBoard.error);
      }

      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["communities-feed"] });
    },
  });

  const isLoading = createBoardMutation.isPending;

  const onSubmit = (values: FormSchema) => {
    createBoardMutation.mutate(values);
  };

  const handleClose = () => {
    if (isLoading) return;
    form.reset(DEFAULTS);
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[440px]! max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-1 pb-0">
          <DialogTitle className="text-[22px] -mb-1 font-medium text-theme-text-primary">
            {t.modals.createBoard.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[14px] text-theme-text-subtle">
            {t.modals.createBoard.subtitle}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-2.5 px-5 pt-0 pb-4">
              <div className="flex items-stretch gap-3 max-sm:flex-col">
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-0.5">
                        <FormLabel
                          htmlFor="create-board-name"
                          className={fieldLabelClassName}
                        >
                          {t.modals.createBoard.nameLabel}
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="create-board-name"
                            disabled={isLoading}
                            className="h-9 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder={t.modals.createBoard.namePlaceholder}
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
                    name="description"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-0.5">
                        <FormLabel
                          htmlFor="create-board-description"
                          className={fieldLabelClassName}
                        >
                          {t.modals.createBoard.descriptionLabel}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            id="create-board-description"
                            disabled={isLoading}
                            className="scrollbar-ultra-thin field-sizing-fixed min-h-[96px] max-h-[160px] w-full min-w-0 resize-none rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder={t.modals.createBoard.tellUsMore}
                            autoComplete="off"
                            maxLength={300}
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px] leading-tight" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex w-full shrink-0 sm:w-[132px]">
                  <FormField
                    control={form.control}
                    name="imageUpload"
                    render={({ field }) => (
                      <FormItem className="flex w-full flex-1 flex-col gap-0.5">
                        <FormLabel className={fieldLabelClassName}>
                          Imagen (opcional)
                        </FormLabel>
                        <div className="flex flex-1 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-3">
                          <div className="flex w-full flex-1 items-center justify-center text-center">
                            <FormControl>
                              <FileUpload
                                endpoint="boardImage"
                                value={field.value || ""}
                                onChange={field.onChange}
                                uploadButtonClassName="border-theme-border bg-theme-bg-secondary/40 text-theme-text-subtle transition-all hover:border-theme-border hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                                label={t.common.uploadBoardImage}
                              />
                            </FormControl>
                          </div>
                        </div>
                        <FormMessage className="text-[11px] leading-tight" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <p className={fieldLabelClassName}>{visibilityLabel}</p>
                <div
                  className="flex rounded-lg border border-theme-border bg-theme-bg-edit-form/60 p-1"
                  role="group"
                  aria-label={visibilityLabel}
                >
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      form.setValue("isPrivate", false, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[14px] transition disabled:cursor-not-allowed disabled:opacity-70",
                      !isPrivate
                        ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                        : "bg-transparent text-theme-text-subtle hover:bg-theme-bg-secondary hover:text-theme-text-primary",
                    )}
                  >
                    <Globe className="h-5 w-5 shrink-0" />
                    <span>{t.modals.createBoard.publicOptionLabel}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      form.setValue("isPrivate", true, { shouldValidate: true })
                    }
                    className={cn(
                      "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md text-[14px] transition disabled:cursor-not-allowed disabled:opacity-70",
                      isPrivate
                        ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                        : "bg-transparent text-theme-text-subtle hover:bg-theme-bg-secondary hover:text-theme-text-primary",
                    )}
                  >
                    <Lock className="h-5 w-5 shrink-0" />
                    <span>{t.modals.createBoard.privateOptionLabel}</span>
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-theme-border px-5 py-1">
              <div className="flex w-full items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  variant="ghost"
                  className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-6.5 cursor-pointer rounded-lg bg-theme-tab-button-bg px-4 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {t.modals.createBoard.createButton}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
