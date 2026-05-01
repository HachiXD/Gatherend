import type { GradientColorStop } from "./types";

export type ThemeGradientColorInput = string | GradientColorStop;

export function normalizeThemeGradientPosition(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.max(0, Math.min(100, Math.round(position)));
}

export function normalizeThemeGradientColorStops<T extends GradientColorStop>(
  colors: readonly T[],
): T[] {
  return colors
    .map((stop) => ({
      ...stop,
      position: normalizeThemeGradientPosition(stop.position),
    }))
    .sort((a, b) => a.position - b.position) as T[];
}

export function normalizeThemeGradientColors(
  colors: readonly ThemeGradientColorInput[] | undefined,
  defaultColors: readonly GradientColorStop[] = [],
): GradientColorStop[] {
  const sourceColors = colors && colors.length > 0 ? colors : defaultColors;

  return normalizeThemeGradientColorStops(
    sourceColors.map((item, index, arr) => {
      if (typeof item === "string") {
        const position =
          arr.length === 1 ? 50 : Math.round((index / (arr.length - 1)) * 100);
        return { color: item, position };
      }

      return {
        color: item.color,
        position: item.position,
      };
    }),
  );
}

export function buildThemeGradientStopsCss(
  colors: readonly ThemeGradientColorInput[],
): string {
  return normalizeThemeGradientColors(colors)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
}
