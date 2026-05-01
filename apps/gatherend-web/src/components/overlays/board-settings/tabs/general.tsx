"use client";

import axios, { AxiosError } from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useBoardMutations } from "@/hooks/use-board-data";
import { toast } from "sonner";
import { Board } from "@prisma/client";
import { useTranslation } from "@/i18n";

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
import { Textarea } from "@/components/ui/textarea";
import { getBoardImageUrl } from "@/lib/avatar-utils";
import {
  getStoredUploadAssetId,
  getStoredUploadValueFromAsset,
} from "@/lib/upload-values";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface GeneralTabProps {
  board: Board & {
    imageAsset?: ClientUploadedAsset | null;
    bannerAsset?: ClientUploadedAsset | null;
  };
}

const PANEL_SHELL =
  "rounded-lg border border-theme-border mr-1.5 bg-theme-bg-overlay-primary/78 px-4 py-4 sm:px-5 sm:py-5";
const FIELD_KICKER =
  "text-[11px] font-bold uppercase tracking-[0.06em] text-theme-text-subtle";
const FIELD_INPUT_CLASS =
  "h-8 -mt-1.5 rounded-lg border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0";
const FIELD_TEXTAREA_CLASS =
  "rounded-lg -mt-1.5 border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0";
const HEADER_PANEL_SHELL =
  "rounded-lg border border-theme-border mr-1.5 bg-theme-bg-overlay-primary/78 px-4 py-4 sm:px-5 sm:py-5";
const HOVER_ACTION_BUTTON_CLASS =
  "flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[14px] transition border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text";

const schema = z.object({
  name: z
    .string()
    .min(2, { message: "Board name is required (min 2 chars)" })
    .max(50, { message: "Board name cannot exceed 50 characters" }),
  description: z
    .string()
    .max(300, { message: "Description cannot exceed 300 characters" })
    .optional(),
  imageUpload: z.string().optional(),
  bannerUpload: z.string().optional(),
});

type FormSchema = z.infer<typeof schema>;

type ModerationBlockedResponse = {
  error?: string;
  message?: string;
};

export const GeneralTab = ({ board }: GeneralTabProps) => {
  const { updateBoard, invalidateBoard } = useBoardMutations(board.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isBumping, setIsBumping] = useState(false);
  const { t } = useTranslation();
  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: board.name,
      description: board.description || "",
      imageUpload: getStoredUploadValueFromAsset(board.imageAsset),
      bannerUpload: getStoredUploadValueFromAsset(board.bannerAsset),
    },
  });

  const watchedBoardName = form.watch("name");

  const boardImagePreviewUrl = getBoardImageUrl(
    board.imageAsset?.url,
    board.id,
    watchedBoardName || board.name,
    256,
  );

  //  BUMP  //
  const handleBump = async () => {
    try {
      setIsBumping(true);
      await axios.post(`/api/boards/${board.id}/refresh`);
      toast.success(t.overlays.boardSettings.general.bumpSuccess);
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ minutesLeft?: number }>;

      if (axiosError.response?.status === 429) {
        const minutesLeft = axiosError.response.data?.minutesLeft || 0;
        toast.error(
          t.overlays.boardSettings.general.bumpCooldown.replace(
            "{minutes}",
            String(minutesLeft),
          ),
        );
      } else {
        toast.error(t.overlays.boardSettings.general.bumpError);
      }
    } finally {
      setIsBumping(false);
    }
  };

  //  SUBMIT  //
  const onSubmit = async (values: FormSchema) => {
    try {
      setIsSaving(true);

      // Actualizar información básica del board
      const currentImageAssetId = board.imageAsset?.id ?? null;
      const currentBannerAssetId = board.bannerAsset?.id ?? null;
      const nextImageAssetId = getStoredUploadAssetId(values.imageUpload);
      const nextBannerAssetId = getStoredUploadAssetId(values.bannerUpload);
      const imageWasChanged = nextImageAssetId !== currentImageAssetId;
      const bannerWasChanged = nextBannerAssetId !== currentBannerAssetId;
      const payload: {
        name: string;
        description?: string;
        imageAssetId?: string | null;
        bannerAssetId?: string | null;
      } = {
        name: values.name,
        description: values.description,
      };

      if (imageWasChanged) {
        payload.imageAssetId = nextImageAssetId;
      }
      if (bannerWasChanged) {
        payload.bannerAssetId = nextBannerAssetId;
      }

      const response = await axios.patch(`/api/boards/${board.id}`, payload);
      const updatedBoard = response.data as Board & {
        imageAsset?: ClientUploadedAsset | null;
        bannerAsset?: ClientUploadedAsset | null;
      };

      updateBoard({
        name: updatedBoard.name,
        description: updatedBoard.description || null,
        ...(imageWasChanged && {
          imageAssetId: nextImageAssetId,
          imageAsset: updatedBoard.imageAsset ?? null,
        }),
        ...(bannerWasChanged && {
          bannerAssetId: nextBannerAssetId,
          bannerAsset: updatedBoard.bannerAsset ?? null,
        }),
      });

      invalidateBoard();

      toast.success(t.overlays.boardSettings.general.updateSuccess);
    } catch (error: unknown) {
      console.error(error);

      const axiosError = error as AxiosError<ModerationBlockedResponse>;

      // Handle moderation errors specifically
      if (axiosError.response?.data?.error === "MODERATION_BLOCKED") {
        const message =
          axiosError.response.data.message ||
          "Content was blocked by moderation.";
        toast.error(message, {
          duration: 5000,
          description:
            t.overlays.boardSettings.general.moderationErrorDescription,
        });
      } else {
        toast.error(t.overlays.boardSettings.general.updateError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-2 pb-10 text-theme-text-subtle">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.general.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {t.overlays.boardSettings.general.subtitle}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <section className={PANEL_SHELL}>
            <div className="-mt-3 -mb-2.5 flex flex-col items-start gap-8 md:flex-row">
              <div className="w-full space-y-3 md:w-[200px] md:self-center">
                <div className="flex items-center justify-center text-center">
                  <FormField
                    control={form.control}
                    name="imageUpload"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <FileUpload
                            endpoint="boardImage"
                            value={field.value || ""}
                            previewUrl={boardImagePreviewUrl}
                            onChange={field.onChange}
                            uploadButtonClassName="rounded-lg border-theme-border-subtle bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                          />
                        </FormControl>
                        <FormMessage className="-mt-1 text-[11px] leading-tight" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleBump}
                  disabled={isBumping}
                  className={HOVER_ACTION_BUTTON_CLASS}
                >
                  {isBumping
                    ? t.overlays.boardSettings.general.bumping
                    : t.overlays.boardSettings.general.bumpButton}
                </Button>

                <FormField
                  control={form.control}
                  name="bannerUpload"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className={FIELD_KICKER}>
                        Banner (opcional)
                      </FormLabel>
                      <FormControl>
                        <FileUpload
                          endpoint="boardBanner"
                          value={field.value || ""}
                          previewUrl={board.bannerAsset?.url ?? null}
                          onChange={field.onChange}
                          uploadButtonClassName="w-full rounded-lg border-theme-border-subtle bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                          imagePreviewWrapperClassName="h-20 w-full"
                          imagePreviewClassName="h-20 w-full rounded-lg"
                          label="Banner"
                        />
                      </FormControl>
                      <FormMessage className="-mt-1 text-[11px] leading-tight" />
                    </FormItem>
                  )}
                />
              </div>

              <div className=" w-full flex-1 space-y-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="board-general-name"
                        className={FIELD_KICKER}
                      >
                        {t.overlays.boardSettings.general.boardNameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="board-general-name"
                          disabled={isSaving}
                          className={cn(FIELD_INPUT_CLASS, "text-[14px]")}
                          placeholder={
                            t.overlays.boardSettings.general
                              .boardNamePlaceholder
                          }
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="board-general-description"
                        className={FIELD_KICKER}
                      >
                        {t.overlays.boardSettings.general.descriptionLabel}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="board-general-description"
                          disabled={isSaving}
                          className={cn(
                            FIELD_TEXTAREA_CLASS,
                            "scrollbar-ultra-thin max-h-[120px] resize-none overflow-y-auto px-3 py-2 text-[14px]",
                          )}
                          placeholder={
                            t.overlays.boardSettings.general
                              .descriptionPlaceholder
                          }
                          autoComplete="off"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section className={PANEL_SHELL}>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-6.5 min-w-[120px] -my-3 cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover"
              >
                {isSaving
                  ? t.overlays.boardSettings.general.saving
                  : t.overlays.boardSettings.general.saveChanges}
              </Button>
            </div>
          </section>
        </form>
      </Form>
    </div>
  );
};
