"use client";

import { useMemo, type CSSProperties } from "react";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

/**
 * Genera los estilos CSS para headers de community usando el mismo
 * sistema que el chat/conversation header, pero adaptado al accent del board
 * cuando existe dominantColor.
 */
export function useCommunityHeaderStyle(): CSSProperties {
  const themeMode = useEffectiveThemeMode();

  return useMemo(() => {
    const usesLightMath = themeMode === "light";

    return {
      "--community-header-bg-base": "var(--theme-bg-quaternary)",
      "--community-header-bg-top": usesLightMath
        ? "color-mix(in srgb, white 28%, var(--theme-bg-quaternary) 72%)"
        : "color-mix(in srgb, white 18%, var(--theme-bg-quaternary) 82%)",
      "--community-header-bg-mid": usesLightMath
        ? "color-mix(in srgb, white 12%, var(--theme-bg-quaternary) 88%)"
        : "color-mix(in srgb, white 8%, var(--theme-bg-quaternary) 92%)",
      "--community-header-bg-bottom": usesLightMath
        ? "color-mix(in srgb, black 12%, var(--theme-bg-quaternary) 88%)"
        : "color-mix(in srgb, black 18%, var(--theme-bg-quaternary) 82%)",
      "--community-header-highlight": usesLightMath
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.24)",
      "--community-header-shadow": usesLightMath
        ? "rgba(0,0,0,0.16)"
        : "rgba(0,0,0,0.28)",
      backgroundColor: "var(--theme-bg-quaternary)",
      backgroundImage:
        "linear-gradient(180deg, var(--community-header-bg-top) 0%, var(--community-header-bg-mid) 52%, var(--community-header-bg-bottom) 100%)",
      "--community-header-btn-bg": "var(--theme-chat-input-button-bg)",
      "--community-header-btn-hover": "var(--theme-chat-input-surface-bg)",
      "--community-header-btn-text": "var(--theme-text-secondary)",
      "--community-header-btn-muted": "var(--theme-text-tertiary)",
      "--community-header-btn-ring": "var(--theme-border-secondary)",
    } as CSSProperties;
  }, [themeMode]);
}
