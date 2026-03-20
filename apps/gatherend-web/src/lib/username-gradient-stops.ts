import type { GradientColorStop } from "../../types";

type GradientStopLike = {
  color: string;
  position: number;
};

export function normalizeUsernameGradientPosition(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.max(0, Math.min(100, Math.round(position)));
}

export function normalizeUsernameGradientStops<T extends GradientStopLike>(
  colors: readonly T[],
): T[] {
  return colors
    .map((stop) => ({
      ...stop,
      position: normalizeUsernameGradientPosition(stop.position),
    }))
    .sort((a, b) => a.position - b.position) as T[];
}

export function buildUsernameGradientStopsCss(
  colors: readonly GradientStopLike[],
): string {
  return normalizeUsernameGradientStops(colors)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
}

export function getFirstUsernameGradientStop(
  colors: readonly GradientColorStop[],
): GradientColorStop | null {
  return normalizeUsernameGradientStops(colors)[0] ?? null;
}
