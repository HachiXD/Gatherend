"use client";

import { useMemo, type CSSProperties } from "react";
import { useBoardAccent } from "@/hooks/use-board-accent";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

/**
 * Genera los estilos CSS para headers de community usando el mismo
 * sistema que el leftbar (useBoardAccent → generatePaletteFromBase).
 * El backgroundColor es bgPrimary (clampeado 13-16% lightness en dark mode).
 */
export function useCommunityHeaderStyle(
  dominantColor: string | null | undefined,
): CSSProperties {
  const accentVars = useBoardAccent(dominantColor);
  const themeMode = useEffectiveThemeMode();

  return useMemo(() => {
    const bg = accentVars?.["--leftbar-bg"] ?? "var(--theme-bg-secondary)";
    const usesLightMath = themeMode === "light";

    return {
      backgroundColor: bg,
      "--community-header-btn-bg": usesLightMath
        ? `color-mix(in srgb, ${bg} 86%, black)`
        : `color-mix(in srgb, ${bg} 82%, white)`,
      "--community-header-btn-hover": usesLightMath
        ? `color-mix(in srgb, ${bg} 72%, black)`
        : `color-mix(in srgb, ${bg} 68%, white)`,
      "--community-header-btn-text": usesLightMath
        ? `color-mix(in srgb, black 82%, ${bg} 18%)`
        : `color-mix(in srgb, white 88%, ${bg} 12%)`,
      "--community-header-btn-muted": usesLightMath
        ? `color-mix(in srgb, black 58%, ${bg} 42%)`
        : `color-mix(in srgb, white 68%, ${bg} 32%)`,
      "--community-header-btn-ring": usesLightMath
        ? `color-mix(in srgb, black 24%, ${bg} 76%)`
        : `color-mix(in srgb, white 28%, ${bg} 72%)`,
    } as CSSProperties;
  }, [accentVars, themeMode]);
}
