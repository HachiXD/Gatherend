"use client";

import { useMemo } from "react";
import { themeColorsToCssVars } from "@/lib/theme/utils";
import { resolveThemeColors } from "@/lib/theme/runtime";
import { useEffectiveThemeConfig } from "@/hooks/use-effective-theme-config";

function toHex(color: string): string {
  const rgb = color.match(/\d+/g);
  if (!rgb || rgb.length < 3) return color;
  return (
    "#" +
    rgb
      .slice(0, 3)
      .map((v) => Number(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function useBoardAccent(
  dominantColor: string | null | undefined,
): Record<string, string> | null {
  const themeConfig = useEffectiveThemeConfig();

  return useMemo(() => {
    if (!dominantColor) return null;
    const hex = dominantColor.startsWith("#") ? dominantColor : toHex(dominantColor);
    const colors = resolveThemeColors(themeConfig, hex);
    return {
      ...themeColorsToCssVars(colors),
      "--leftbar-bg": colors.bgPrimary,
    };
  }, [dominantColor, themeConfig]);
}
