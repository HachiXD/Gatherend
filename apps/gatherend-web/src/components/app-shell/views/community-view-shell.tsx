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

function hslToRgb(hue: number, saturation: number, lightness: number) {
  if (saturation === 0) {
    const value = Math.round(lightness * 255);
    return [value, value, value] as const;
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let channel = t;

    if (channel < 0) channel += 1;
    if (channel > 1) channel -= 1;
    if (channel < 1 / 6) return p + (q - p) * 6 * channel;
    if (channel < 1 / 2) return q;
    if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
    return p;
  };

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  ] as const;
}

function toMutedVariant(color: string) {
  const rgb = parseRgbColor(color);
  if (!rgb) return color;

  const [red, green, blue] = rgb;
  const { h, s, l } = rgbToHsl(red, green, blue);
  const mutedSaturation = Math.max(0.08, s * 0.2);
  const mutedLightness = Math.min(0.42, Math.max(0.18, l * 0.9 + 0.03));
  const [mutedRed, mutedGreen, mutedBlue] = hslToRgb(
    h,
    mutedSaturation,
    mutedLightness,
  );

  return `rgb(${mutedRed}, ${mutedGreen}, ${mutedBlue})`;
}

function darkenLightness(color: string) {
  const rgb = parseRgbColor(color);
  if (!rgb) return color;

  const [red, green, blue] = rgb;
  const { h, s, l } = rgbToHsl(red, green, blue);
  const darkerLightness = Math.max(0.08, l * 0.72);
  const [darkerRed, darkerGreen, darkerBlue] = hslToRgb(h, s, darkerLightness);

  return `rgb(${darkerRed}, ${darkerGreen}, ${darkerBlue})`;
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
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

function CommunityViewShellInner({
  community,
  activeSection,
  onSelectSection,
  headerLeading,
  headerAction,
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

  const { dominantColor, handleImageLoad } = useColorExtraction({
    imageUrl: bannerImageUrl,
  });

  const headerBg = dominantColor || "var(--theme-bg-secondary)";
  const tabsBg = dominantColor
    ? toMutedVariant(dominantColor)
    : "var(--theme-community-tabs-fallback-bg)";
  const activeTabBg = dominantColor
    ? darkenLightness(tabsBg)
    : "var(--theme-community-tabs-fallback-active-bg)";
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
        "--community-header-btn-top-border": useLightButtonVariant
          ? `color-mix(in srgb, ${headerBg} 38%, white)`
          : `color-mix(in srgb, ${headerBg} 58%, white)`,
        "--community-header-btn-shadow-border": useLightButtonVariant
          ? `color-mix(in srgb, ${headerBg} 58%, black)`
          : `color-mix(in srgb, ${headerBg} 42%, black)`,
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
    const postLabel = community.postCount === 1 ? "post" : "posts";

    return `${community.memberCount} ${memberLabel} • ${community.activeBoardsCount} ${boardLabel} • ${community.postCount} ${postLabel}`;
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
            </div>
            <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
              <div className="px-0 pt-3.5 pb-2.5" style={headerButtonStyles}>
                <div className="ml-4 mr-6 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {headerLeading && (
                      <div className="shrink-0">{headerLeading}</div>
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
                    <div className="shrink-0">{headerAction}</div>
                  )}
                </div>
              </div>
              <div className="flex w-full items-stretch" role="tablist">
                <button
                  type="button"
                  onClick={() => onSelectSection("boards")}
                  style={{
                    backgroundColor:
                      activeSection === "boards" ? activeTabBg : tabsBg,
                  }}
                  className={cn(
                    "flex-1 h-9 cursor-pointer flex items-center justify-center text-sm font-semibold transition-colors",
                    activeSection === "boards"
                      ? "text-white border-b-2 border-theme-button-primary/70"
                      : "text-white/50 border-b border-white/20 hover:text-white hover:border-white/40",
                  )}
                  role="tab"
                  aria-selected={activeSection === "boards"}
                >
                  Boards
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSection("posts")}
                  style={{
                    backgroundColor:
                      activeSection === "posts" ? activeTabBg : tabsBg,
                  }}
                  className={cn(
                    "flex-1 h-9 flex cursor-pointer items-center justify-center text-sm font-semibold transition-colors",
                    activeSection === "posts"
                      ? "text-white border-b-2 border-theme-button-primary/70"
                      : "text-white/50 border-b border-white/20 hover:text-white hover:border-white/40",
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
