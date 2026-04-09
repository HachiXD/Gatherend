"use client";

import { useMemo, type CSSProperties } from "react";
import { useBoardAccent } from "@/hooks/use-board-accent";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

/**
 * Genera los estilos CSS para headers de community usando el mismo
 * sistema que el chat/conversation header, pero adaptado al accent del board
 * cuando existe dominantColor.
 */
export function useCommunityHeaderStyle(
  dominantColor: string | null | undefined,
): CSSProperties {
  const accentVars = useBoardAccent(dominantColor);
  const themeMode = useEffectiveThemeMode();

  return useMemo(() => {
    const bg =
      accentVars?.["--theme-bg-quaternary"] ?? "var(--theme-bg-quaternary)";
    const buttonBg =
      accentVars?.["--theme-chat-input-button-bg"] ??
      "var(--theme-chat-input-button-bg)";
    const buttonHover =
      accentVars?.["--theme-chat-input-surface-bg"] ??
      "var(--theme-chat-input-surface-bg)";
    const buttonRing =
      accentVars?.["--theme-border-secondary"] ??
      "var(--theme-border-secondary)";
    const usesLightMath = themeMode === "light";

    return {
      "--community-header-bg-base": bg,
      "--community-header-bg-top": usesLightMath
        ? `color-mix(in srgb, white 28%, ${bg} 72%)`
        : `color-mix(in srgb, white 18%, ${bg} 82%)`,
      "--community-header-bg-mid": usesLightMath
        ? `color-mix(in srgb, white 12%, ${bg} 88%)`
        : `color-mix(in srgb, white 8%, ${bg} 92%)`,
      "--community-header-bg-bottom": usesLightMath
        ? `color-mix(in srgb, black 12%, ${bg} 88%)`
        : `color-mix(in srgb, black 18%, ${bg} 82%)`,
      "--community-header-highlight": usesLightMath
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.24)",
      "--community-header-shadow": usesLightMath
        ? "rgba(0,0,0,0.16)"
        : "rgba(0,0,0,0.28)",
      backgroundColor: bg,
      backgroundImage:
        "linear-gradient(180deg, var(--community-header-bg-top) 0%, var(--community-header-bg-mid) 52%, var(--community-header-bg-bottom) 100%)",
      "--community-header-btn-bg": buttonBg,
      "--community-header-btn-hover": buttonHover,
      "--community-header-btn-text": usesLightMath
        ? `color-mix(in srgb, black 82%, ${buttonBg} 18%)`
        : `color-mix(in srgb, white 88%, ${buttonBg} 12%)`,
      "--community-header-btn-muted": usesLightMath
        ? `color-mix(in srgb, black 58%, ${buttonBg} 42%)`
        : `color-mix(in srgb, white 68%, ${buttonBg} 32%)`,
      "--community-header-btn-ring": buttonRing,
    } as CSSProperties;
  }, [accentVars, themeMode]);
}
