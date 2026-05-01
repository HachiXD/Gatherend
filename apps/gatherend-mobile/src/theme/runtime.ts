import { DEFAULT_BASE_COLOR } from "./presets";
import { normalizeThemeGradientColors } from "./gradient-stops";
import type {
  GradientConfig,
  GradientColorStop,
  ThemeColors,
  ThemeConfig,
  ThemeMode,
} from "./types";
import {
  generateLightPaletteFromBase,
  generatePaletteFromBase,
  isValidHexColor,
  validateGradientConfig,
} from "./utils";

type NormalizedGradientConfig = Omit<GradientConfig, "colors"> & {
  colors: GradientColorStop[];
};

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
): NormalizedGradientConfig | undefined {
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

export function getThemeMode(
  config: ThemeConfig | null | undefined,
): ThemeMode {
  return config?.mode === "light" ? "light" : "dark";
}

function getFirstGradientColor(
  config: ThemeConfig | null | undefined,
): string | null {
  const normalizedGradient = normalizeThemeGradientConfig(config?.gradient);
  const firstColor = normalizedGradient?.colors[0]?.color;

  return firstColor && isValidHexColor(firstColor) ? firstColor : null;
}

export function getThemeBaseColor(
  config: ThemeConfig | null | undefined,
): string {
  return (
    getFirstGradientColor(config) || config?.baseColor || DEFAULT_BASE_COLOR
  );
}

export function resolveThemeColors(
  config: ThemeConfig | null | undefined,
  baseColorOverride?: string,
): ThemeColors {
  const baseColor = baseColorOverride || getThemeBaseColor(config);
  const mode = getThemeMode(config);

  return mode === "light"
    ? generateLightPaletteFromBase(baseColor)
    : generatePaletteFromBase(baseColor);
}
