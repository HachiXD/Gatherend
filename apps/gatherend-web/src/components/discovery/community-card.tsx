"use client";

import { cn } from "@/lib/utils";
import { memo, useMemo, useState } from "react";
import { Siren } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useTranslation } from "@/i18n";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getDerivedColors } from "@/lib/color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export interface CommunityCardProps {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  boardCount: number;
  recentPostCount7d: number;
  onExplore: () => void;
  className?: string;
}

function CommunityCardInner({
  id,
  name,
  imageAsset,
  memberCount,
  boardCount,
  recentPostCount7d,
  onExplore,
  className,
}: CommunityCardProps) {
  const { onOpen } = useModal();
  const { data: currentProfile } = useCurrentProfile();
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageAsset?.url || null;

  const displayImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    return getNeverAnimatedImageUrl(imageUrl, { w: 1024, h: 512, q: 82 });
  }, [imageUrl]);

  // Use Web Worker for color extraction (eliminates main thread blocking)
  const { dominantColor, handleImageLoad } = useColorExtraction({
    imageUrl: displayImageUrl || imageUrl,
  });

  const derivedColors = getDerivedColors(dominantColor || "#1F2D2C");

  return (
    <div
      data-community-id={id}
      className={cn(
        "border-t-1 border-r-2 border-b-2 overflow-hidden",
        "shadow-md hover:shadow-xl transition-all duration-300",
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
      onClick={onExplore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExplore();
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
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-101"
              loading="eager"
              decoding="async"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
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

        {/* REPORT BUTTON - esquina superior derecha */}
        <div className="absolute top-2 right-2 z-10">
          <ActionTooltip label={t.discovery.reportCommunity} side="left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen("reportCommunity", {
                  reportCommunityId: id,
                  reportCommunityName: name,
                  reportCommunityImageUrl: imageUrl,
                  profileId: currentProfile?.id,
                });
              }}
              className="cursor-pointer border bg-black/50 p-1.5 text-white/70 transition-colors hover:bg-red-500/30 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 rounded-none border-[color:var(--report-border)]"
              style={
                {
                  "--report-border": derivedColors.reliefBorderLight,
                } as React.CSSProperties
              }
            >
              <Siren className="h-4 w-4" />
            </button>
          </ActionTooltip>
        </div>
      </div>

      {/* INFO */}
      <div className="flex flex-row items-center px-4 py-2">
        <div className="flex flex-col gap-1">
          <div className="text-[14px] text-white/70 font-medium">
            {memberCount} miembro{memberCount === 1 ? "" : "s"} — {boardCount}{" "}
            board{boardCount === 1 ? "" : "s"} abierto
            {boardCount === 1 ? "" : "s"} — {recentPostCount7d} post
            {recentPostCount7d === 1 ? "" : "s"} esta semana
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoizado para que inline arrows en onExplore no causen re-renders
// si las demás props son iguales (name, id, etc.)
export const CommunityCard = memo(CommunityCardInner);
