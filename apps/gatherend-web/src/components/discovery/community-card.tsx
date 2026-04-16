"use client";

import { cn } from "@/lib/utils";
import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { Siren } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "@/i18n";

const ActionTooltip = lazy(() =>
  import("@/components/action-tooltip").then((m) => ({
    default: m.ActionTooltip,
  })),
);
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getDerivedColors } from "@/lib/color-extraction";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const ReportButton = memo(function ReportButton({
  boardId,
  boardName,
  imageUrl,
  borderColor,
}: {
  boardId: string;
  boardName: string;
  imageUrl: string | null;
  borderColor: string;
}) {
  const { onOpen } = useModal();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpen("reportBoard", {
        reportBoardId: boardId,
        reportBoardName: boardName,
        reportBoardImageUrl: imageUrl,
      });
    },
    [onOpen, boardId, boardName, imageUrl],
  );

  const buttonElement = (
    <button
      onClick={handleClick}
      className="cursor-pointer border rounded-sm bg-black/50 p-1.5 text-white/70 transition-colors hover:bg-red-500/30 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 border-[color:var(--report-border)]"
      style={{ "--report-border": borderColor } as React.CSSProperties}
    >
      <Siren className="h-4 w-4" />
    </button>
  );

  return (
    <div
      className="absolute top-2 right-2 z-10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? (
        <Suspense fallback={buttonElement}>
          <ActionTooltip label={t.discovery.reportBoard} side="left">
            {buttonElement}
          </ActionTooltip>
        </Suspense>
      ) : (
        buttonElement
      )}
    </div>
  );
});

export interface CommunityCardProps {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  recentPostCount7d: number;
  onExplore: (id: string) => void;
  className?: string;
}

function CommunityCardInner({
  id,
  name,
  imageAsset,
  memberCount,
  recentPostCount7d,
  onExplore,
  className,
}: CommunityCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageAsset?.url || null;
  const precomputedColor = imageAsset?.dominantColor || null;

  const displayImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    return getOptimizedStaticUiImageUrl(imageUrl, { w: 450, h: 180, q: 82 });
  }, [imageUrl]);

  const { dominantColor: extractedColor, handleImageLoad } = useColorExtraction(
    {
      imageUrl: precomputedColor ? null : displayImageUrl || imageUrl,
    },
  );

  const dominantColor = precomputedColor || extractedColor;
  const derivedColors = getDerivedColors(dominantColor || "#1F2D2C");

  return (
    <div
      data-community-id={id}
      className={cn(
        "border-t-1 border-r-2 border-b-2 overflow-hidden rounded-sm",
        "w-full h-fit flex flex-col group cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        className,
      )}
      style={{
        backgroundColor: dominantColor || "var(--theme-bg-secondary)",
        borderTopColor: derivedColors.reliefBorderLight,
        borderRightColor: derivedColors.reliefBorder,
        borderBottomColor: derivedColors.reliefBorder,
      }}
      role="button"
      tabIndex={0}
      onClick={() => onExplore(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExplore(id);
        }
      }}
      aria-label={`Explorar ${name}`}
    >
      {/* TITLE */}
      <div className="px-4 py-2">
        <div className="text-[22px] font-bold text-white truncate">{name}</div>
      </div>

      {/* HEADER IMAGE */}
      <div className="relative w-full h-30 bg-theme-bg-tertiary overflow-hidden">
        {imageUrl && displayImageUrl && !imageFailed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageUrl}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              decoding="async"
              crossOrigin="anonymous"
              onLoad={precomputedColor ? undefined : handleImageLoad}
              onError={() => setImageFailed(true)}
            />
            {/* FADE OVERLAY */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-theme-text-muted bg-theme-bg-tertiary">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* REPORT BUTTON - isolated component with its own hover state */}
        <ReportButton
          boardId={id}
          boardName={name}
          imageUrl={imageUrl}
          borderColor={derivedColors.reliefBorderLight}
        />
      </div>

      {/* INFO */}
      <div className="flex flex-row items-center px-4 py-2">
        <div className="flex flex-col gap-1">
          <div className="text-[14px] text-white/70 font-medium">
            {memberCount} miembro{memberCount === 1 ? "" : "s"} —{" "}
            {recentPostCount7d} post
            {recentPostCount7d === 1 ? "" : "s"} esta semana
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoizado — onExplore ahora es (id: string) => void, referencia estable
export const CommunityCard = memo(CommunityCardInner);
