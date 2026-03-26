"use client";

import {
  memo,
  type CSSProperties,
  type ReactNode,
  useMemo,
  type RefObject,
} from "react";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import { cn } from "@/lib/utils";
import type { CommunityOverview } from "@/hooks/discovery/use-community-overview";

function parseRgbColor(color: string) {
  const rgbMatch = color.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
  );
  if (rgbMatch) {
    return rgbMatch.slice(1, 4).map(Number) as [number, number, number];
  }

  const rgbaMatch = color.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9.]+)\s*\)$/i,
  );
  if (rgbaMatch) {
    return rgbaMatch.slice(1, 4).map(Number) as [number, number, number];
  }

  return null;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function isVeryDarkColor(color: string) {
  const rgb = parseRgbColor(color);
  if (!rgb) return false;

  const [red, green, blue] = rgb;
  const { l } = rgbToHsl(red, green, blue);
  return l <= 0.24;
}

interface CommunityViewShellProps {
  community: CommunityOverview | null;
  activeSection: "boards" | "posts";
  onSelectSection: (section: "boards" | "posts") => void;
  headerLeading?: ReactNode;
  headerAction?: ReactNode;
  bannerAction?: ReactNode;
  belowHeader?: ReactNode;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

function CommunityViewShellInner({
  community,
  activeSection,
  onSelectSection,
  headerLeading,
  headerAction,
  bannerAction,
  belowHeader,
  scrollContainerRef,
  children,
}: CommunityViewShellProps) {
  const bannerImageUrl = community?.imageAsset?.url
    ? getNeverAnimatedImageUrl(community.imageAsset.url, {
        w: 2048,
        h: 512,
        q: 82,
      })
    : undefined;

  const precomputedColor = community?.imageAsset?.dominantColor || null;

  const { dominantColor: extractedColor, handleImageLoad } = useColorExtraction(
    {
      imageUrl: precomputedColor ? null : bannerImageUrl,
    },
  );

  const dominantColor = precomputedColor || extractedColor;
  const headerBg = dominantColor || "var(--theme-bg-secondary)";
  const useLightButtonVariant = isVeryDarkColor(headerBg);
  const headerButtonStyles = useMemo(
    () =>
      ({
        backgroundColor: headerBg,
        "--community-header-btn-bg": useLightButtonVariant
          ? `color-mix(in srgb, ${headerBg} 82%, white)`
          : `color-mix(in srgb, ${headerBg} 72%, black)`,
        "--community-header-btn-hover": useLightButtonVariant
          ? `color-mix(in srgb, ${headerBg} 68%, white)`
          : `color-mix(in srgb, ${headerBg} 58%, black)`,
        "--community-header-btn-text": `color-mix(in srgb, white 88%, ${headerBg} 12%)`,
        "--community-header-btn-muted": `color-mix(in srgb, white 68%, ${headerBg} 32%)`,
        "--community-header-btn-ring": `color-mix(in srgb, white 28%, ${headerBg} 72%)`,
      }) as CSSProperties,
    [headerBg, useLightButtonVariant],
  );

  const statsText = useMemo(() => {
    if (!community) return "";

    const memberLabel = community.memberCount === 1 ? "miembro" : "miembros";
    const boardLabel =
      community.activeBoardsCount === 1 ? "board abierto" : "boards abiertos";
    const postLabel =
      community.recentPostCount7d === 1
        ? "post esta semana"
        : "posts esta semana";

    return `${community.memberCount} ${memberLabel} • ${community.activeBoardsCount} ${boardLabel} • ${community.recentPostCount7d} ${postLabel}`;
  }, [community]);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-auto scrollbar-chat"
      >
        {community && (
          <>
            <div className="relative h-36 w-full shrink-0 bg-theme-bg-tertiary">
              {bannerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerImageUrl}
                  alt={community.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                  crossOrigin="anonymous"
                  onLoad={handleImageLoad}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-theme-bg-tertiary text-6xl font-bold text-theme-text-muted">
                  {community.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
              {bannerAction && (
                <div className="absolute bottom-3 right-4">{bannerAction}</div>
              )}
            </div>
            <div className="sticky top-0 z-20 shrink-0  transition-colors duration-300">
              <div className="px-0 pt-3.5 pb-2.5" style={headerButtonStyles}>
                <div className="ml-4 mr-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {headerLeading && (
                      <div className="shrink-0 self-center -mt-1">
                        {headerLeading}
                      </div>
                    )}
                    <div className="-mt-2 min-w-0 flex-1">
                      <h1 className="text-[20px] font-bold text-white">
                        {community.name}
                      </h1>
                      <p className="-mt-0.5 text-[12px] text-white/70">
                        {statsText}
                      </p>
                    </div>
                  </div>

                  {headerAction && (
                    <div className="shrink-0 self-center -mt-1">
                      {headerAction}
                    </div>
                  )}
                </div>
              </div>
              {belowHeader && (
                <div style={headerButtonStyles} className="pb-2.5 px-3">
                  {belowHeader}
                </div>
              )}
              <div className="flex gap-0 p-0" role="tablist">
                <button
                  type="button"
                  onClick={() => onSelectSection("boards")}
                  className={cn(
                    "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border px-3 text-[13px] transition",
                    activeSection === "boards"
                      ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                  )}
                  role="tab"
                  aria-selected={activeSection === "boards"}
                >
                  Boards
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSection("posts")}
                  className={cn(
                    "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border px-3 text-[13px] transition",
                    activeSection === "posts"
                      ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                  )}
                  role="tab"
                  aria-selected={activeSection === "posts"}
                >
                  Forum
                </button>
              </div>
            </div>
          </>
        )}

        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

export const CommunityViewShell = memo(CommunityViewShellInner);
