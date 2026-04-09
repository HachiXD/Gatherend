import { DEFAULT_BASE_COLOR } from "@/lib/theme/presets";
import { normalizeThemeGradientColors } from "@/lib/theme/gradient-stops";
import type {
  GradientConfig,
  GradientColorStop,
  ThemeColors,
  ThemeConfig,
  ThemeMode,
} from "@/lib/theme/types";
import {
  applyTransparencyToBackgrounds,
  generateLightPaletteFromBase,
  generatePaletteFromBase,
  isValidHexColor,
  validateGradientConfig,
} from "@/lib/theme/utils";

export function parseThemeConfig(config: unknown): ThemeConfig | null {
  if (!config || typeof config !== "object") return null;

  const c = config as Record<string, unknown>;
  const result: ThemeConfig = {};

  if (
    c.baseColor &&
    typeof c.baseColor === "string" &&
    isValidHexColor(c.baseColor)
  ) {
    result.baseColor = c.baseColor;
  }

  if (c.gradient && validateGradientConfig(c.gradient)) {
    result.gradient = c.gradient as GradientConfig;
  }

  if (c.mode === "dark" || c.mode === "light") {
    result.mode = c.mode as ThemeMode;
  }

  return result;
}

function normalizeThemeGradientConfig(
  gradient: GradientConfig | undefined,
): (GradientConfig & { colors: GradientColorStop[] }) | undefined {
  if (!gradient || !validateGradientConfig(gradient)) {
    return undefined;
  }

  return {
    type: gradient.type,
    angle: Math.max(0, Math.min(180, Math.round(gradient.angle))),
    colors: normalizeThemeGradientColors(gradient.colors),
  };
}

export function normalizeThemeConfig(
  config: ThemeConfig | null | undefined,
): ThemeConfig | null {
  if (!config) {
    return null;
  }

  const normalized: ThemeConfig = {};

  if (config.baseColor && config.baseColor !== DEFAULT_BASE_COLOR) {
    normalized.baseColor = config.baseColor;
  }

  if (config.mode === "light") {
    normalized.mode = "light";
  }

  const normalizedGradient = normalizeThemeGradientConfig(config.gradient);
  if (normalizedGradient) {
    normalized.gradient = normalizedGradient;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function areThemeConfigsEqual(
  left: ThemeConfig | null | undefined,
  right: ThemeConfig | null | undefined,
): boolean {
  const normalizedLeft = normalizeThemeConfig(left);
  const normalizedRight = normalizeThemeConfig(right);

  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  if (normalizedLeft.baseColor !== normalizedRight.baseColor) {
    return false;
  }

  if (normalizedLeft.mode !== normalizedRight.mode) {
    return false;
  }

  const leftGradient = normalizeThemeGradientConfig(normalizedLeft.gradient);
  const rightGradient = normalizeThemeGradientConfig(normalizedRight.gradient);

  if (!leftGradient || !rightGradient) {
    return leftGradient === rightGradient;
  }

  if (
    leftGradient.type !== rightGradient.type ||
    leftGradient.angle !== rightGradient.angle ||
    leftGradient.colors.length !== rightGradient.colors.length
  ) {
    return false;
  }

  return leftGradient.colors.every((color, index) => {
    const otherColor = rightGradient.colors[index];
    return (
      color.color === otherColor.color &&
      color.position === otherColor.position
    );
  });
}

export function getThemeMode(config: ThemeConfig | null | undefined): ThemeMode {
  return config?.mode === "light" ? "light" : "dark";
}

export function getThemeBaseColor(
  config: ThemeConfig | null | undefined,
): string {
  return config?.baseColor || DEFAULT_BASE_COLOR;
}

export function hasThemeGradient(
  config: ThemeConfig | null | undefined,
): boolean {
  return !!config?.gradient;
}

export function resolveThemeColors(
  config: ThemeConfig | null | undefined,
  baseColorOverride?: string,
): ThemeColors {
  const baseColor = baseColorOverride || getThemeBaseColor(config);
  const mode = getThemeMode(config);

  let colors =
    mode === "light"
      ? generateLightPaletteFromBase(baseColor)
      : generatePaletteFromBase(baseColor);

  if (config?.gradient) {
    colors = applyTransparencyToBackgrounds(colors);
  }

  return colors;
}
