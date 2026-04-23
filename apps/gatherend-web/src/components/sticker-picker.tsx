"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useStickers } from "@/hooks/use-stickers";
import { useUploadSticker, useDeleteSticker } from "@/hooks/use-upload-sticker";
import { Sticker, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import type { ClientSticker } from "@/types/uploaded-assets";
import { cn } from "@/lib/utils";

interface StickerPickerProps {
  onChange: (sticker: ClientSticker) => void;
  profileId: string;
  triggerClassName?: string;
  iconClassName?: string;
}

function getMutationErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }

  const response = (error as { response?: { data?: { message?: unknown } } })
    .response;
  return typeof response?.data?.message === "string"
    ? response.data.message
    : undefined;
}

function StickerPickerPopover({
  onChange,
  profileId,
  open,
  onOpenChange,
  triggerEl,
}: StickerPickerProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEl: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { data: stickers, isLoading } = useStickers(profileId);
  const { mutate: uploadSticker, isPending: isUploading } = useUploadSticker();
  const { mutate: deleteSticker } = useDeleteSticker();
  const [selectedCategory] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [cellInnerPx, setCellInnerPx] = useState(80);
  const gridObserverRef = useRef<ResizeObserver | null>(null);

  const attachGridRef = useCallback((node: HTMLDivElement | null) => {
    gridObserverRef.current?.disconnect();
    gridObserverRef.current = null;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") return;

    const compute = () => {
      const firstChild = node.firstElementChild as HTMLElement | null;
      if (!firstChild) return;
      const rect = firstChild.getBoundingClientRect();
      // Grid cells use `p-2` in the button, so subtract 16px to approximate the inner
      // content box that `AnimatedSticker` fills (`w-full h-full`).
      const next = Math.max(1, Math.round(rect.width) - 16);
      setCellInnerPx((prev) => (prev === next ? prev : next));
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(node);
    gridObserverRef.current = ro;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(max-width: 420px)");
    if (!mq) return;
    const update = () => setIsNarrowScreen(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    // Safari < 14
    mq.addListener?.(update);
    return () => {
      mq.removeEventListener?.("change", update);
      mq.removeListener?.(update);
    };
  }, []);

  const userStickers =
    stickers?.filter((s) => s.uploaderId === profileId) || [];
  const canUploadMore = userStickers.length < 10;

  // Group stickers by category

  const filteredStickers =
    selectedCategory === "all"
      ? stickers
      : stickers?.filter((s) => s.category === selectedCategory);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.stickerPicker.fileSizeTooLarge);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(t.stickerPicker.onlyImagesAllowed);
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("name", file.name.split(".")[0]);

    uploadSticker(
      { formData, profileId },
      {
        onSuccess: () => {
          toast.success(t.stickerPicker.stickerUploaded);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
        onError: (error: unknown) => {
          toast.error(
            getMutationErrorMessage(error) || t.stickerPicker.uploadFailed,
          );
        },
      },
    );
  };

  const handleDeleteSticker = (stickerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteSticker(
      { stickerId, profileId },
      {
        onSuccess: () => {
          toast.success(t.stickerPicker.stickerDeleted);
        },
        onError: (error: unknown) => {
          toast.error(
            getMutationErrorMessage(error) || t.stickerPicker.deleteFailed,
          );
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild suppressHydrationWarning>
        {triggerEl}
      </PopoverTrigger>
      <PopoverContent
        side={isNarrowScreen ? "top" : "left"}
        sideOffset={isNarrowScreen ? 12 : -22}
        collisionPadding={isNarrowScreen ? 8 : 0}
        className="bg-theme-picker-bg border-theme-picker-border rounded-lg shadow-lg mb-16 w-[320px] max-[420px]:w-[calc(100vw-16px)] max-[420px]:translate-y-[64px] p-0"
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-theme-text-muted" />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-theme-picker-border">
              <span className="text-sm font-medium text-theme-text-subtle">
                {t.stickerPicker.stickers}
              </span>

              <span className="text-sm text-theme-text-muted">
                {userStickers.length}/10
              </span>
            </div>
            {/* Sticker grid */}
            <div
              ref={attachGridRef}
              className="scrollbar-ultra-thin grid grid-cols-4 max-[420px]:grid-cols-3 gap-2 p-3 max-h-[300px] overflow-y-auto"
            >
              {/* Upload button as first item */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!canUploadMore || isUploading}
                className="relative aspect-square rounded-lg bg-theme-bg-secondary 
                  hover:bg-theme-bg-tertiary transition p-2 
                  flex items-center cursor-pointer justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  canUploadMore
                    ? t.stickerPicker.uploadCustomSticker
                    : t.stickerPicker.maxStickersReached
                }
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-theme-text-muted" />
                ) : (
                  <Plus className="w-6 h-6 text-theme-text-muted group-hover:text-theme-text-subtle transition" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {filteredStickers?.map((sticker) => {
                const isOwnSticker = sticker.uploaderId === profileId;

                const stickerButton = (
                  <button
                    onClick={() => onChange(sticker)}
                    className="relative aspect-square rounded-none hover:bg-theme-channel-hover cursor-pointer transition p-2 group w-full h-full"
                    title={sticker.name}
                  >
                    <AnimatedSticker
                      src={sticker.asset?.url || ""}
                      alt={sticker.name}
                      containerClassName="w-full h-full"
                      className="group-hover:scale-110 transition"
                      fallbackWidthPx={cellInnerPx}
                      fallbackHeightPx={cellInnerPx}
                    />
                  </button>
                );

                // Only show context menu for user's own stickers
                if (isOwnSticker) {
                  return (
                    <ContextMenu key={sticker.id}>
                      <ContextMenuTrigger asChild>
                        <div className="relative aspect-square">
                          {stickerButton}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-theme-bg-secondary border-theme-border-secondary">
                        <ContextMenuItem
                          onClick={(e) => handleDeleteSticker(sticker.id, e)}
                          className="text-red-500 focus:text-red-600 hover:bg-theme-channel-hover focus:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t.stickerPicker.deleteFromCollection}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                }

                return (
                  <div key={sticker.id} className="relative aspect-square">
                    {stickerButton}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export const StickerPicker = ({
  onChange,
  profileId,
  triggerClassName,
  iconClassName,
}: StickerPickerProps) => {
  const [popoverEnabled, setPopoverEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  const enablePopoverOnce = useCallback(() => {
    setPopoverEnabled(true);
  }, []);

  const openOnFirstInteraction = useCallback(
    (e: React.SyntheticEvent) => {
      if (popoverEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      setPopoverEnabled(true);
      setOpen(true);
    },
    [popoverEnabled],
  );

  const triggerEl = (
    <button
      type="button"
      suppressHydrationWarning
      onMouseEnter={enablePopoverOnce}
      onClickCapture={openOnFirstInteraction}
      onKeyDownCapture={(e) => {
        if (popoverEnabled) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        openOnFirstInteraction(e);
      }}
      className={cn(
        "inline-flex items-center justify-center",
        triggerClassName,
      )}
    >
      <Sticker
        className={cn(
          "text-theme-chat-input-icon transition",
          triggerClassName
            ? "h-4 w-4 text-current"
            : "hover:text-theme-chat-input-icon-hover cursor-pointer",
          iconClassName,
        )}
      />
    </button>
  );

  if (!popoverEnabled) return triggerEl;

  return (
    <StickerPickerPopover
      onChange={onChange}
      profileId={profileId}
      open={open}
      onOpenChange={setOpen}
      triggerEl={triggerEl}
    />
  );
};
