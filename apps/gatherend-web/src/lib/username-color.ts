import { DEFAULT_USERNAME_COLOR } from "@/lib/theme/presets";
import type { UsernameColor, UsernameColorGradient } from "../../types";
import { JsonValue } from "@prisma/client/runtime/library";
import {
  buildUsernameGradientStopsCss,
  getFirstUsernameGradientStop,
  normalizeUsernameGradientStops,
} from "@/lib/username-gradient-stops";

// Color Conversion Utilities (inline to avoid circular dependencies)

/**
 * Convierte un color hex a HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convierte HSL a hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function invertHexColor(hex: string): string {
  const normalized = hex.replace(/^#/, "");
  if (normalized.length !== 6) {
    return DEFAULT_USERNAME_COLOR;
  }

  const r = 255 - parseInt(normalized.slice(0, 2), 16);
  const g = 255 - parseInt(normalized.slice(2, 4), 16);
  const b = 255 - parseInt(normalized.slice(4, 6), 16);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Username Color Adaptation for Theme Contrast

/**
 * Rangos de luminosidad óptimos para usernames según el tema
 * - Dark theme: colores claros para contrastar con fondos oscuros (55-85%)
 * - Light theme: colores oscuros para contrastar con fondos claros (25-50%)
 */
const USERNAME_LIGHTNESS_RANGES = {
  dark: { min: 55, max: 85 },
  light: { min: 25, max: 50 },
} as const;

/**
 * Adapta un color hex para que tenga buen contraste con el tema actual
 * Mantiene el Hue (H) original, ajusta Saturation (S) y Lightness (L)
 * @param hex - Color en formato hex
 * @param themeMode - Modo del tema: "dark" o "light"
 * @returns Color hex adaptado para contraste
 */
export function adaptColorForTheme(
  hex: string,
  themeMode: "dark" | "light",
): string {
  const { h, s, l } = hexToHsl(hex);
  const range = USERNAME_LIGHTNESS_RANGES[themeMode];

  // Ajustar luminosidad al rango óptimo para el tema
  let newL = l;
  if (l < range.min) {
    newL = range.min;
  } else if (l > range.max) {
    newL = range.max;
  }

  // Ajustar saturación para mejor visibilidad (mínimo 40%, máximo 90%)
  const newS = Math.max(40, Math.min(90, s));

  return hslToHex(h, newS, newL);
}

/**
 * Adapta un UsernameColor completo (solid o gradient) para el tema
 * @param color - UsernameColor parseado
 * @param themeMode - Modo del tema
 * @returns UsernameColor adaptado
 */
export function adaptUsernameColorForTheme(
  color: UsernameColor,
  themeMode: "dark" | "light",
): UsernameColor {
  if (!color) return null;

  if (color.type === "solid") {
    return {
      type: "solid",
      color: adaptColorForTheme(color.color, themeMode),
    };
  }

  if (color.type === "gradient") {
    return {
      ...color,
      colors: color.colors.map((stop) => ({
        ...stop,
        color: adaptColorForTheme(stop.color, themeMode),
      })),
    };
  }

  return null;
}

// Parsing Functions

/**
 * Parse usernameColor from database (could be string legacy or new JSON format)
 */
export function parseUsernameColor(
  color: JsonValue | string | null | undefined,
): UsernameColor {
  if (!color) return null;

  // Legacy string format - convert to solid
  if (typeof color === "string") {
    return { type: "solid", color };
  }

  // New JSON format
  if (typeof color === "object" && color !== null && !Array.isArray(color)) {
    const obj = color as Record<string, unknown>;
    if (obj.type === "solid" && typeof obj.color === "string") {
      return { type: "solid", color: obj.color };
    }
    if (obj.type === "gradient" && Array.isArray(obj.colors)) {
      const gradient = obj as unknown as UsernameColorGradient;
      return {
        ...gradient,
        colors: normalizeUsernameGradientStops(gradient.colors),
      };
    }
  }

  return null;
}

/**
 * Get the display color for a username (for solid colors or first color of gradient)
 * Used for simple text color styling
 */
export function getDisplayColor(
  color: JsonValue | string | null | undefined,
): string {
  const parsed = parseUsernameColor(color);
  if (!parsed) return DEFAULT_USERNAME_COLOR;

  if (parsed.type === "solid") {
    return parsed.color;
  }

  if (parsed.type === "gradient" && parsed.colors.length > 0) {
    return getFirstUsernameGradientStop(parsed.colors)?.color ?? DEFAULT_USERNAME_COLOR;
  }

  return DEFAULT_USERNAME_COLOR;
}

/**
 * Get a softened inverse of the username color for larger surfaces such as
 * profile-card headers. This keeps the "opposite color" idea while toning it
 * down so it behaves better as a background.
 */
export function getSoftInvertedUsernameColor(
  color: JsonValue | string | null | undefined,
  themeMode: "dark" | "light",
): string {
  const parsed = parseUsernameColor(color);
  const sourceColor = parsed
    ? parsed.type === "solid"
      ? parsed.color
      : (getFirstUsernameGradientStop(parsed.colors)?.color ??
          DEFAULT_USERNAME_COLOR)
    : DEFAULT_USERNAME_COLOR;

  const invertedHex = invertHexColor(sourceColor);
  const { h, s, l } = hexToHsl(invertedHex);

  const softenedS = clamp(Math.round(s * 0.42), 14, 38);
  const softenedL =
    themeMode === "dark"
      ? clamp(Math.round(22 + l * 0.18), 24, 38)
      : clamp(Math.round(82 + (l - 50) * 0.12), 74, 88);

  return hslToHex(h, softenedS, softenedL);
}

/**
 * Options for username color styling
 */
export interface UsernameColorStyleOptions {
  /**
   * If true, the color is from the current user's own profile (no adaptation)
   * If false, adapt the color for better contrast with current theme
   */
  isOwnProfile?: boolean;
  /**
   * Current theme mode. Required when isOwnProfile is false
   */
  themeMode?: "dark" | "light";
}

/**
 * Get CSS style for username color (supports both solid and gradient)
 * @param color - The username color from database
 * @param options - Optional configuration for color adaptation
 *   - isOwnProfile: true = show exact color, false = adapt for theme contrast
 *   - themeMode: required when isOwnProfile is false
 */
export function getUsernameColorStyle(
  color: JsonValue | string | null | undefined,
  options?: UsernameColorStyleOptions,
): React.CSSProperties {
  let parsed = parseUsernameColor(color);
  if (!parsed) return { color: DEFAULT_USERNAME_COLOR };

  // Si no es el perfil propio y tenemos themeMode, adaptar el color
  if (options && options.isOwnProfile === false && options.themeMode) {
    parsed = adaptUsernameColorForTheme(parsed, options.themeMode);
    if (!parsed) return { color: DEFAULT_USERNAME_COLOR };
  }

  if (parsed.type === "solid") {
    return { color: parsed.color };
  }

  if (parsed.type === "gradient") {
    const stops = buildUsernameGradientStopsCss(parsed.colors);
    return {
      backgroundImage: `linear-gradient(${parsed.angle}deg, ${stops})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      // For animated gradients, we need larger background for animation
      ...(parsed.animated ? { backgroundSize: "200% 200%" } : {}),
    };
  }

  return { color: DEFAULT_USERNAME_COLOR };
}

/**
 * Get CSS class for gradient animation (hover effect)
 * Returns the appropriate hover animation class based on animation type
 */
export function getGradientAnimationClass(
  color: JsonValue | string | null | undefined,
): string {
  const parsed = parseUsernameColor(color);
  if (!parsed || parsed.type !== "gradient" || !parsed.animated) return "";

  switch (parsed.animationType) {
    case "shift":
      return "username-gradient-shift";
    case "shimmer":
      return "username-gradient-shimmer";
    case "pulse":
      return "username-gradient-pulse";
    default:
      return "username-gradient-shift";
  }
}

/**
 * Check if the color is a gradient
 */
export function isGradientColor(
  color: JsonValue | string | null | undefined,
): boolean {
  const parsed = parseUsernameColor(color);
  return parsed?.type === "gradient";
}

/**
 * Check if the gradient has animation enabled
 */
export function hasGradientAnimation(
  color: JsonValue | string | null | undefined,
): boolean {
  const parsed = parseUsernameColor(color);
  return parsed?.type === "gradient" && parsed.animated === true;
}

/**
 * Get CSS background value for ring/border styling
 * Returns a solid color or gradient that can be used as CSS background
 */
export function getRingBackground(
  color: JsonValue | string | null | undefined,
  fallback: string = "var(--theme-border-primary)",
): string {
  const parsed = parseUsernameColor(color);
  if (!parsed) return fallback;

  if (parsed.type === "solid") {
    return parsed.color;
  }

  if (parsed.type === "gradient" && parsed.colors.length >= 2) {
    const stops = buildUsernameGradientStopsCss(parsed.colors);
    return `linear-gradient(${parsed.angle}deg, ${stops})`;
  }

  return fallback;
}
