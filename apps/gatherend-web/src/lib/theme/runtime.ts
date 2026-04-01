import { DEFAULT_BASE_COLOR } from "@/lib/theme/presets";
import type {
  GradientConfig,
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
