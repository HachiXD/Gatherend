"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Smile, Loader2 } from "lucide-react";
import { memo, useEffect, useState, useCallback } from "react";
import {
  Theme,
  EmojiClickData,
  EmojiStyle,
  Categories,
} from "emoji-picker-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

// Lazy load emoji-picker-react con virtualización built-in
const EmojiPickerReact = dynamic(() => import("emoji-picker-react"), {
  loading: () => (
    <div className="w-[350px] max-[420px]:w-[calc(100vw-16px)] h-[400px] flex items-center justify-center rounded-sm bg-theme-picker-bg">
      <Loader2 className="h-6 w-6 animate-spin text-theme-accent-light" />
    </div>
  ),
  ssr: false,
});

interface EmojiPickerProps {
  onChange: (value: string) => void;
  triggerClassName?: string;
  iconClassName?: string;
}

function EmojiPickerPopover({
  onChange,
  open,
  onOpenChange,
  triggerEl,
}: EmojiPickerProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEl: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

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

  const handleEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      onChange(emojiData.emoji);
      onOpenChange(false);
    },
    [onChange, onOpenChange],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild suppressHydrationWarning>
        {triggerEl}
      </PopoverTrigger>
      <PopoverContent
        side={isNarrowScreen ? "top" : "right"}
        sideOffset={isNarrowScreen ? 12 : 40}
        collisionPadding={isNarrowScreen ? 8 : 0}
        className="bg-transparent border-none shadow-none drop-shadow-none rounded-sm mb-16 p-0 max-[420px]:w-[calc(100vw-16px)] max-[420px]:translate-y-[64px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPickerReact
          className="!rounded-lg"
          onEmojiClick={handleEmojiClick}
          width={isNarrowScreen ? "100%" : 350}
          height={400}
          theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
          lazyLoadEmojis={true}
          autoFocusSearch={false}
          searchPlaceHolder={t.emojiPicker.search}
          emojiStyle={EmojiStyle.GOOGLE}
          categories={[
            { category: Categories.SUGGESTED, name: t.emojiPicker.recent },
            {
              category: Categories.SMILEYS_PEOPLE,
              name: t.emojiPicker.smileys,
            },
            {
              category: Categories.ANIMALS_NATURE,
              name: t.emojiPicker.animals,
            },
            { category: Categories.FOOD_DRINK, name: t.emojiPicker.food },
            { category: Categories.TRAVEL_PLACES, name: t.emojiPicker.travel },
            { category: Categories.ACTIVITIES, name: t.emojiPicker.activities },
            { category: Categories.OBJECTS, name: t.emojiPicker.objects },
            { category: Categories.SYMBOLS, name: t.emojiPicker.symbols },
            { category: Categories.FLAGS, name: t.emojiPicker.flags },
          ]}
          style={
            {
              "--epr-bg-color": "var(--theme-picker-bg)",
              "--epr-hover-bg-color": "var(--theme-button-primary)",
              "--epr-focus-bg-color": "transparent",
              "--epr-search-input-bg-color": "var(--theme-bg-tertiary)",
              "--epr-search-input-bg-color-active": "var(--theme-bg-tertiary)",
              "--epr-search-border-color-active": "var(--theme-accent-light)",
              "--epr-search-input-text-color": "var(--theme-text-light)",
              "--epr-search-input-placeholder-color": "var(--theme-text-muted)",
              "--epr-category-label-bg-color": "var(--theme-bg-tertiary)",
              "--epr-category-label-text-color": "var(--theme-text-light)",
              "--epr-picker-border-color": "var(--theme-picker-border)",
              "--epr-picker-border-radius": "0.125rem",
              "--epr-search-input-border-radius": "8px",
            } as React.CSSProperties
          }
          skinTonesDisabled={true}
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  );
}

export const EmojiPicker = memo(
  ({ onChange, triggerClassName, iconClassName }: EmojiPickerProps) => {
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
        <Smile
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
      <EmojiPickerPopover
        onChange={onChange}
        open={open}
        onOpenChange={setOpen}
        triggerEl={triggerEl}
      />
    );
  },
);

EmojiPicker.displayName = "EmojiPicker";
