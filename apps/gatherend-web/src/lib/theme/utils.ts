import { buildThemeGradientStopsCss } from "./gradient-stops";
import type { ThemeColors, GradientConfig } from "./types";

/**
 * Convierte un color hex a HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remover el # si existe
  hex = hex.replace(/^#/, "");

  // Parsear los valores RGB
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
export function hslToHex(h: number, s: number, l: number): string {
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

/**
 * Convierte un color hex a rgba con transparencia
 */
export function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Ajusta la luminosidad de un color
 */
export function adjustLightness(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  const newL = Math.max(0, Math.min(100, l + amount));
  return hslToHex(h, s, newL);
}

/**
 * Ajusta la saturación de un color
 */
export function adjustSaturation(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  const newS = Math.max(0, Math.min(100, s + amount));
  return hslToHex(h, newS, l);
}

function toCommunityTabsFallbackBg(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  const mutedS = Math.max(8, s * 0.2);
  const mutedL = Math.min(42, Math.max(18, l * 0.9 + 3));
  return hslToHex(h, mutedS, mutedL);
}

function toCommunityTabsFallbackActiveBg(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  const darkerL = Math.max(8, l * 0.72);
  return hslToHex(h, s, darkerL);
}

/**
 * Rangos de luminosidad para colores de degradado según el modo
 * Dark: colores oscuros (8-30%)
 * Light: colores claros (65-92%)
 */
const GRADIENT_LIGHTNESS_RANGES = {
  dark: { min: 8, max: 30 },
  light: { min: 65, max: 92 },
} as const;

/**
 * Ajusta un color para que cumpla con los rangos de luminosidad del degradado
 * según el modo del tema (dark o light)
 * @param hex - Color en formato hex
 * @param mode - Modo del tema: "dark" o "light"
 * @returns Color hex ajustado al rango de luminosidad correspondiente
 */
export function clampGradientColor(
  hex: string,
  mode: "dark" | "light",
): string {
  const { h, s, l } = hexToHsl(hex);
  const range = GRADIENT_LIGHTNESS_RANGES[mode];

  // Clampear la luminosidad al rango permitido
  const clampedL = Math.max(range.min, Math.min(range.max, l));

  return hslToHex(h, s, clampedL);
}

/**
 * Genera una paleta completa de colores a partir de un color base
 * Este es el algoritmo principal del sistema de temas
 */
export function generatePaletteFromBase(baseColor: string): ThemeColors {
  const { h, s, l } = hexToHsl(baseColor);

  // Helper para saturación adaptativa con límites
  const clampS = (ratio: number, min: number, max: number) =>
    Math.min(max, Math.max(min, s * ratio));

  // Helper para luminosidad adaptativa con límites (mantiene jerarquía)
  const clampL = (ratio: number, min: number, max: number) =>
    Math.min(max, Math.max(min, l * ratio));

  const bgSecondary = hslToHex(
    h + 4,
    clampS(0.32, 22, 43),
    clampL(0.47, 19, 22),
  );
  const communityTabsFallbackBg = toCommunityTabsFallbackBg(bgSecondary);
  const communityTabsFallbackActiveBg = toCommunityTabsFallbackActiveBg(
    communityTabsFallbackBg,
  );

  return {
    // Backgrounds - Muy oscuros con el hue del color base
    // Jerarquía: Primary < Secondary < Tertiary < Quaternary (más oscuro a más claro)
    bgPrimary: hslToHex(h + 3, clampS(0.35, 24, 45), clampL(0.32, 13, 16)),
    bgOverlayPrimary: hslToHex(
      h + 3,
      clampS(0.35, 24, 45),
      clampL(0.32, 13, 16),
    ), // Mismo que bgPrimary, para overlays
    bgDropdownMenuPrimary: hslToHex(
      h + 3,
      clampS(0.35, 24, 45),
      clampL(0.32, 13, 16),
    ), // Mismo que bgPrimary, para dropdown menus
    bgSecondary,
    bgTertiary: hslToHex(h + 6, clampS(0.25, 17, 37), clampL(0.57, 23, 26)),
    bgQuaternary: hslToHex(h + 4, clampS(0.26, 18, 39), clampL(0.72, 28, 31)),
    bgInputPlus: hslToHex(h + 4, clampS(0.26, 18, 39), clampL(0.72, 29, 32)), // Igual que bgQuaternary
    bgQuinary: hslToHex(h + 2, clampS(0.29, 20, 41), clampL(0.42, 17, 22)),
    bgInput: hslToHex(h + 5, clampS(0.26, 22, 39), clampL(0.45, 19, 24)),

    // Accents - Color base y variaciones
    accentPrimary: hslToHex(h - 14, clampS(0.8, 55, 65), clampL(1.75, 80, 90)),
    accentLight: hslToHex(h, clampS(0.8, 40, 60), clampL(1.75, 65, 75)),
    accentHover: hslToHex(h, clampS(1.0, 45, 70), clampL(1.37, 50, 60)),

    // Borders - Intermedios entre fondo y accent
    borderPrimary: hslToHex(h + 4, clampS(0.4, 21, 22), clampL(0.75, 22, 33)),
    borderSecondary: hslToHex(h, clampS(0.4, 20, 35), clampL(0.52, 23, 24)),

    // Buttons
    buttonPrimary: hslToHex(h, clampS(0.9, 50, 80), clampL(1.0, 36, 44)),
    buttonPrimaryActive: hslToHex(
      h,
      clampS(0.9, 50, 80),
      clampL(1.08, 39, 47),
    ),
    buttonHover: hslToHex(h, clampS(1.0, 55, 85), clampL(1.12, 41, 49)),
    buttonSendHover: hslToHex(h, clampS(0.75, 40, 50), clampL(1.1, 40, 46)),

    // Text - Jerarquía de legibilidad
    textAccent: hslToHex(h, clampS(0.7, 35, 50), clampL(1.87, 70, 80)),
    textMuted: hslToHex(h, clampS(0.07, 3, 8), clampL(1.62, 60, 70)),
    textLight: hslToHex(h, clampS(0.43, 20, 40), clampL(2.32, 90, 96)),
    textSubtle: hslToHex(h, clampS(0.29, 14, 26), clampL(2.0, 76, 84)),
    textPrimary: "#ffffff",
    textSecondary: hslToHex(h + 70, clampS(0.14, 6, 14), clampL(1.87, 84, 89)), // Mensajes de chat
    textTertiary: hslToHex(h + 70, clampS(0.12, 5, 12), clampL(1.5, 65, 73)), // timestamp
    textInverse: hslToHex(h, clampS(0.22, 10, 20), clampL(0.37, 12, 18)),

    // Channels - Jerarquía: Bg < Hover < Active
    channelBg: hslToHex(h + 5, clampS(0.29, 20, 36), clampL(0.57, 23, 26)),
    channelHover: hslToHex(h + 3, clampS(0.29, 22, 34), clampL(0.57, 22, 24)),
    channelActive: hslToHex(h + 3, clampS(0.29, 20, 34), clampL(0.57, 24, 26)),

    // UI Elements
    tooltipBg: hslToHex(h + 1, clampS(0.36, 33, 38), clampL(0.87, 34, 40)),
    avatarFallbackBg: hslToHex(h, clampS(0.32, 15, 28), clampL(0.57, 20, 26)),
    pickerBg: hslToHex(h - 6, clampS(0.29, 16, 26), clampL(0.72, 29, 34)),
    pickerBorder: hslToHex(h - 7, clampS(0.26, 15, 24), clampL(0.45, 18, 24)),
    menuHover: hslToHex(h, clampS(0.36, 22, 30), clampL(0.45, 16, 20)),
    menuAccentText: hslToHex(h, clampS(1.1, 70, 85), clampL(0.95, 35, 42)),
    navActionBg: hslToHex(h, clampS(0.32, 23, 28), clampL(0.42, 19, 23)),
    navActionHover: hslToHex(h - 3, clampS(0.67, 44, 52), clampL(0.87, 32, 38)),
    addFriendIcon: hslToHex(h - 3, clampS(0.78, 52, 60), clampL(1.0, 43, 48)),
    addFriendHover: hslToHex(h, clampS(0.56, 36, 44), clampL(1.65, 62, 70)),
    textMutedAlt: hslToHex(h, clampS(0.06, 3, 8), clampL(1.22, 45, 52)),
    tabActiveBg: hslToHex(h + 1, clampS(0.31, 48, 55), clampL(0.47, 35, 45)),
    tabButtonBg: hslToHex(h - 3, clampS(0.67, 44, 52), clampL(0.87, 32, 38)),
    tabButtonHover: hslToHex(h - 3, clampS(0.67, 44, 52), clampL(1.05, 39, 45)),
    communityTabsFallbackBg,
    communityTabsFallbackActiveBg,

    // Chat Toolbar
    toolbarBg: hslToHex(h, clampS(0.32, 20, 26), clampL(0.42, 15, 19)),
    toolbarIcon: hslToHex(h - 4, clampS(0.25, 15, 21), clampL(1.82, 69, 76)),
    toolbarBorder: hslToHex(h - 1, clampS(0.34, 21, 27), clampL(0.55, 20, 24)),

    // Dropdown Menu
    dropdownBg: hslToHex(h - 1, clampS(0.34, 21, 27), clampL(0.5, 18, 22)),
    dropdownBorder: hslToHex(h - 1, clampS(0.31, 19, 25), clampL(0.6, 22, 26)),
    dropdownHover: hslToHex(h - 2, clampS(0.34, 21, 27), clampL(0.57, 21, 25)),

    // Reactions - active (user reacted)
    reactionActiveBg: hslToHex(
      h - 2,
      clampS(0.44, 28, 34),
      clampL(0.6, 22, 26),
    ),
    reactionActiveBorder: hslToHex(
      h - 1,
      clampS(0.6, 38, 45),
      clampL(1.0, 37, 43),
    ),
    reactionActiveText: hslToHex(
      h - 9,
      clampS(0.24, 14, 20),
      clampL(2.15, 82, 88),
    ),

    // Reactions - default
    reactionBg: hslToHex(h - 1, clampS(0.34, 21, 27), clampL(0.5, 18, 22)),
    reactionBorder: hslToHex(h - 1, clampS(0.31, 19, 25), clampL(0.6, 22, 26)),
    reactionText: hslToHex(h - 1, clampS(0.13, 7, 12), clampL(2.02, 77, 83)),

    // Slot Avatar - Discovery (cyan) - colores fijos semánticos
    slotDiscoveryIcon: hslToHex(186, 58, 60), // cyan fijo
    slotDiscoveryBg: `hsla(186, 58%, 60%, 0.1)`, // cyan con alfa
    // Slot Avatar - Invitation (amber) - colores fijos semánticos
    slotInvitationIcon: hslToHex(34, 70, 65), // amber fijo
    slotInvitationBg: `hsla(34, 70%, 65%, 0.1)`, // amber con alfa
    // Slot Avatar - Border
    slotBorder: `rgba(255, 255, 255, 0.1)`, // white/10 en dark

    // Modal background (siempre opaco, igual que bgSecondary)
    bgModal: hslToHex(h + 4, clampS(0.32, 22, 43), clampL(0.47, 19, 22)),

    // Modal inputs
    bgInputModal: hslToHex(h - 7, clampS(0.2, 12, 17), clampL(0.65, 24, 28)),

    // Cancel button
    bgCancelButton: hslToHex(h - 3, clampS(0.2, 12, 17), clampL(0.65, 24, 28)),
    bgCancelButtonHover: hslToHex(
      h - 3,
      clampS(0.2, 12, 17),
      clampL(0.75, 28, 32),
    ),

    // Chat input icons
    chatInputIcon: hslToHex(h - 10, clampS(0.51, 33, 39), clampL(1.77, 68, 74)),
    chatInputIconHover: hslToHex(
      h - 9,
      clampS(0.43, 27, 33),
      clampL(1.5, 57, 63),
    ),
    chatInputButtonBg: hslToHex(
      h + 4,
      clampS(0.28, 18, 34),
      clampL(0.6, 25, 27),
    ),
    chatInputSurfaceBg: hslToHex(
      h + 5,
      clampS(0.2, 14, 28),
      clampL(0.98, 35, 40),
    ),

    // Channel type buttons (Text/Voice)
    channelTypeActiveBorder: hslToHex(
      h,
      clampS(0.7, 38, 48),
      clampL(0.92, 34, 40),
    ),
    channelTypeActiveSoftBg: hslToHex(
      h,
      clampS(0.52, 24, 34),
      clampL(0.92, 34, 40),
    ),
    channelTypeActiveBg: `hsla(${h}, ${clampS(0.7, 38, 48)}%, ${clampL(
      0.92,
      34,
      40,
    )}%, 0.4)`,
    channelTypeActiveText: hslToHex(
      h,
      clampS(0.55, 28, 38),
      clampL(2.4, 92, 96),
    ),
    channelTypeInactiveBg: hslToHex(
      h,
      clampS(0.24, 11, 18),
      clampL(0.67, 24, 30),
    ),
    channelTypeInactiveBorder: hslToHex(
      h,
      clampS(0.1, 4, 8),
      clampL(1.05, 38, 44),
    ),
    channelTypeInactiveHoverBorder: hslToHex(
      h,
      clampS(0.1, 4, 8),
      clampL(1.2, 44, 50),
    ),
    channelTypeInactiveText: hslToHex(
      h,
      clampS(0.1, 4, 8),
      clampL(2.0, 74, 80),
    ),

    // Scrollbars - Navigation Sidebar
    scrollbarNavThumb: hslToHex(h, clampS(0.22, 10, 20), clampL(0.87, 32, 38)),
    scrollbarNavThumbHover: hslToHex(
      h,
      clampS(0.26, 12, 24),
      clampL(1.12, 42, 48),
    ),

    // Scrollbars - Main (Feed + Chat)
    scrollbarMainThumb: hslToHex(h, clampS(0.26, 12, 24), clampL(1.0, 37, 43)),
    scrollbarMainThumbHover: hslToHex(
      h,
      clampS(0.29, 14, 26),
      clampL(1.25, 47, 53),
    ),

    // App Settings button - target: hsl(171, 39%, 26%)
    appSettingsHover: hslToHex(
      h + 1,
      clampS(0.81, 35, 45),
      clampL(0.74, 24, 28),
    ),

    // Custom User Button - target: hsl(172, 45%, 31%)
    accentCustomUserButton: hslToHex(
      h + 2,
      clampS(0.94, 40, 50),
      clampL(0.89, 28, 34),
    ),

    // Tab hover - target: hsl(169, 37%, 31%)
    bgTabHover: hslToHex(h - 1, clampS(0.77, 33, 42), clampL(0.89, 28, 34)),

    // Reply preview border - mismo color que bgButtonPrimary
    borderAccentItemReplyPreview: hslToHex(
      h,
      clampS(0.9, 50, 80),
      clampL(0.95, 36, 44),
    ),

    // Active channel border - mismo color que buttonPrimary adaptado (dark)
    borderAccentActiveChannel: hslToHex(
      h,
      clampS(0.9, 50, 80),
      clampL(0.95, 36, 44),
    ),

    // Edit form background - dark mode
    bgEditForm: hslToHex(h + 4, clampS(0.32, 22, 43), clampL(0.52, 21, 24)),

    // Notification / Unread indicators - hue complementario (h+180) para máximo contraste con bgPrimary
    // notificationBg: badge vívido (saturation alta, lightness media)
    notificationBg: hslToHex(h + 140, clampS(0.8, 65, 70), clampL(0.8, 24, 30)),
    // unreadBg: fondo sutil para canales/items no leídos (mismo hue complementario, oscuro)
    unreadBg: hslToHex(h + 140, clampS(0.6, 42, 55), clampL(0.65, 39, 44)),
  };
}

/**
 * Genera una paleta de colores LIGHT CANDY/VIBRANTE a partir de un color base
 * Fondos saturados y vibrantes estilo candy (luminosidad 75-88%)
 */
export function generateLightPaletteFromBase(baseColor: string): ThemeColors {
  const { h, s, l } = hexToHsl(baseColor);

  // Helper para saturación adaptativa con límites
  const clampS = (ratio: number, min: number, max: number) =>
    Math.min(max, Math.max(min, s * ratio));

  // Helper para luminosidad adaptativa con límites (mantiene jerarquía)
  const clampL = (ratio: number, min: number, max: number) =>
    Math.min(max, Math.max(min, l * ratio));

  const bgSecondary = hslToHex(
    h + 34,
    clampS(1.43, 65, 100),
    clampL(2.17, 83, 91),
  );
  const communityTabsFallbackBg = toCommunityTabsFallbackBg(bgSecondary);
  const communityTabsFallbackActiveBg = toCommunityTabsFallbackActiveBg(
    communityTabsFallbackBg,
  );

  return {
    // Backgrounds - Vibrantes/Candy con alta saturación
    // Jerarquía invertida para light: Primary > Secondary > Tertiary (más claro a menos claro)
    bgPrimary: hslToHex(h + 30, clampS(1.35, 70, 100), clampL(1.9, 72, 80)),
    bgOverlayPrimary: hslToHex(
      h + 30,
      clampS(1.35, 70, 100),
      clampL(1.9, 72, 80),
    ), // Mismo que bgPrimary, para overlays
    bgDropdownMenuPrimary: hslToHex(
      h + 30,
      clampS(1.35, 70, 100),
      clampL(1.9, 72, 80),
    ), // Mismo que bgPrimary, para dropdown menus
    bgSecondary,
    bgTertiary: hslToHex(h + 35, clampS(1.43, 75, 100), clampL(2.25, 86, 94)),
    bgQuaternary: hslToHex(h + 32, clampS(1.43, 75, 100), clampL(2.1, 80, 88)),
    bgInputPlus: hslToHex(h + 32, clampS(1.43, 75, 100), clampL(2.1, 80, 88)), // Igual que bgQuaternary
    bgQuinary: hslToHex(h + 32, clampS(1.3, 65, 95), clampL(1.97, 75, 83)),
    bgInput: hslToHex(h + 35, clampS(1.3, 60, 90), clampL(2.3, 88, 96)),

    // Accents - Iconos y botones discovery y en chat input
    // Dark usa h-14 para accentPrimary, en light invertimos la relación
    accentPrimary: hslToHex(h + 16, clampS(0.8, 55, 65), clampL(0.55, 18, 28)),
    accentLight: hslToHex(h + 30, clampS(1.1, 65, 85), clampL(1.65, 62, 70)),
    accentHover: hslToHex(h + 30, clampS(1.0, 60, 80), clampL(0.85, 30, 40)),

    // Borders - Definidos pero armoniosos
    // Dark usa h+4, en light usamos h+32 para armonizar con backgrounds
    borderPrimary: hslToHex(h + 32, clampS(0.9, 50, 70), clampL(1.62, 61, 69)),
    borderSecondary: hslToHex(
      h + 30,
      clampS(0.7, 40, 60),
      clampL(1.75, 66, 74),
    ),

    // Buttons - Boton del discovery
    buttonPrimary: hslToHex(h + 28, clampS(1.13, 65, 85), clampL(1.65, 62, 70)),
    buttonPrimaryActive: hslToHex(
      h + 28,
      clampS(1.13, 65, 85),
      clampL(1.72, 65, 73),
    ),
    buttonHover: hslToHex(h + 28, clampS(1.13, 65, 85), clampL(1.52, 57, 65)),
    buttonSendHover: hslToHex(h + 30, clampS(0.9, 50, 65), clampL(1.5, 56, 64)),

    // Text - OSCURO para máxima legibilidad en fondos vibrantes
    textAccent: hslToHex(h + 30, clampS(0.8, 45, 65), clampL(0.55, 18, 26)),
    textMuted: hslToHex(h + 30, clampS(0.67, 35, 55), clampL(1.25, 46, 54)),
    textLight: hslToHex(h + 30, clampS(0.5, 28, 42), clampL(0.35, 10, 18)),
    textSubtle: hslToHex(h + 30, clampS(0.45, 24, 38), clampL(0.65, 22, 32)),
    textPrimary: hslToHex(h + 30, clampS(0.2, 10, 20), clampL(0.35, 10, 18)),
    textSecondary: hslToHex(h + 36, clampS(0.71, 40, 60), clampL(0.75, 26, 34)),
    textTertiary: hslToHex(h + 36, clampS(0.6, 32, 48), clampL(0.95, 34, 42)),
    textInverse: "#ffffff",

    // Channels
    channelBg: hslToHex(h + 34, clampS(0.99, 55, 75), clampL(1.97, 75, 83)),
    channelHover: hslToHex(h + 32, clampS(0.93, 50, 70), clampL(1.85, 70, 78)),
    channelActive: hslToHex(h + 32, clampS(0.99, 55, 75), clampL(1.77, 67, 75)),

    // UI Elements
    tooltipBg: hslToHex(h + 28, clampS(0.5, 35, 50), clampL(1.52, 60, 66)),
    avatarFallbackBg: hslToHex(
      h + 30,
      clampS(1.0, 55, 75),
      clampL(1.72, 65, 73),
    ),
    pickerBg: hslToHex(h + 32, clampS(1.15, 65, 85), clampL(1.87, 71, 79)),
    pickerBorder: hslToHex(h + 32, clampS(0.86, 45, 65), clampL(1.62, 61, 69)),
    menuHover: hslToHex(h + 30, clampS(1.15, 65, 85), clampL(1.72, 65, 73)),
    menuAccentText: hslToHex(h + 30, clampS(0.9, 50, 70), clampL(0.55, 18, 26)),
    navActionBg: hslToHex(h + 30, clampS(1.0, 55, 75), clampL(1.72, 65, 73)),
    navActionHover: hslToHex(h + 38, clampS(0.55, 50, 62), clampL(1.5, 56, 64)),
    addFriendIcon: hslToHex(h + 38, clampS(0.6, 54, 66), clampL(1.62, 40, 48)),
    addFriendHover: hslToHex(
      h + 41,
      clampS(0.55, 50, 62),
      clampL(1.45, 34, 52),
    ),
    textMutedAlt: hslToHex(h + 30, clampS(0.35, 18, 30), clampL(0.85, 30, 38)),
    tabActiveBg: hslToHex(h + 30, clampS(1.0, 55, 75), clampL(1.62, 61, 69)),
    tabButtonBg: hslToHex(h + 38, clampS(0.55, 50, 62), clampL(1.62, 60, 68)),
    tabButtonHover: hslToHex(
      h + 41,
      clampS(0.55, 50, 62),
      clampL(1.45, 54, 62),
    ),
    communityTabsFallbackBg,
    communityTabsFallbackActiveBg,

    // Chat Toolbar
    toolbarBg: hslToHex(h + 30, clampS(1.0, 55, 75), clampL(1.87, 73, 81)),
    toolbarIcon: hslToHex(h + 41, clampS(0.5, 60, 70), clampL(1.62, 60, 68)),
    toolbarBorder: hslToHex(h + 30, clampS(0.86, 45, 65), clampL(1.62, 61, 69)),

    // Dropdown Menu
    dropdownBg: hslToHex(h + 32, clampS(1.15, 65, 85), clampL(1.92, 73, 81)),
    dropdownBorder: hslToHex(
      h + 30,
      clampS(0.86, 45, 65),
      clampL(1.72, 65, 73),
    ),
    dropdownHover: hslToHex(h + 30, clampS(1.0, 55, 75), clampL(1.77, 67, 75)),

    // Reactions - active (user reacted)
    reactionActiveBg: hslToHex(
      h + 30,
      clampS(0.9, 50, 70),
      clampL(1.65, 62, 70),
    ),
    reactionActiveBorder: hslToHex(
      h + 29,
      clampS(0.75, 42, 58),
      clampL(0.7, 24, 32),
    ),
    reactionActiveText: hslToHex(
      h + 21,
      clampS(0.5, 28, 42),
      clampL(0.4, 12, 20),
    ),

    // Reactions - default
    reactionBg: hslToHex(h + 32, clampS(1.0, 55, 75), clampL(1.85, 70, 78)),
    reactionBorder: hslToHex(
      h + 30,
      clampS(0.86, 45, 65),
      clampL(1.62, 61, 69),
    ),
    reactionText: hslToHex(h + 29, clampS(0.45, 24, 38), clampL(0.5, 16, 24)),

    // Slot Avatar - Discovery (cyan) - colores fijos semánticos
    slotDiscoveryIcon: hslToHex(186, 70, 35), // cyan más oscuro para light
    slotDiscoveryBg: `hsla(186, 58%, 45%, 0.2)`, // cyan con más contraste para light
    // Slot Avatar - Invitation (amber) - colores fijos semánticos
    slotInvitationIcon: hslToHex(34, 80, 40), // amber más oscuro para light
    slotInvitationBg: `hsla(34, 70%, 50%, 0.2)`, // amber con más contraste para light
    // Slot Avatar - Border
    slotBorder: `rgba(0, 0, 0, 0.15)`, // black/15 en light

    // Modal background (siempre opaco, igual que bgSecondary)
    bgModal: hslToHex(h + 34, clampS(1.43, 65, 100), clampL(2.17, 83, 91)),

    // Modal inputs
    bgInputModal: hslToHex(h + 30, clampS(0.9, 50, 70), clampL(1.92, 73, 81)),

    // Cancel button
    bgCancelButton: hslToHex(h + 30, clampS(0.8, 45, 65), clampL(1.85, 70, 78)),
    bgCancelButtonHover: hslToHex(
      h + 30,
      clampS(0.8, 45, 65),
      clampL(1.72, 65, 73),
    ),

    // Chat input icons
    chatInputIcon: hslToHex(h + 41, clampS(0.5, 64, 71), clampL(0.87, 62, 72)),
    chatInputIconHover: hslToHex(
      h + 41,
      clampS(0.55, 58, 68),
      clampL(0.75, 55, 65),
    ),
    chatInputButtonBg: hslToHex(
      h + 31,
      clampS(0.95, 50, 70),
      clampL(1.42, 54, 62),
    ),
    chatInputSurfaceBg: hslToHex(
      h + 34,
      clampS(1.0, 55, 75),
      clampL(2.2, 84, 92),
    ),

    // Channel type buttons (Text/Voice)
    channelTypeActiveBorder: hslToHex(
      h + 38,
      clampS(0.7, 55, 68),
      clampL(1.5, 56, 64),
    ),
    channelTypeActiveSoftBg: hslToHex(
      h + 38,
      clampS(0.52, 40, 54),
      clampL(1.5, 56, 64),
    ),
    channelTypeActiveBg: `hsla(${h + 38}, ${clampS(0.7, 55, 68)}%, ${clampL(
      1.5,
      56,
      64,
    )}%, 0.35)`,
    channelTypeActiveText: hslToHex(
      h + 38,
      clampS(0.6, 50, 62),
      clampL(1.35, 50, 58),
    ),
    channelTypeInactiveBg: hslToHex(
      h + 30,
      clampS(0.6, 35, 50),
      clampL(1.85, 70, 78),
    ),
    channelTypeInactiveBorder: hslToHex(
      h + 30,
      clampS(0.4, 22, 35),
      clampL(1.65, 62, 70),
    ),
    channelTypeInactiveHoverBorder: hslToHex(
      h + 30,
      clampS(0.5, 28, 42),
      clampL(1.5, 56, 64),
    ),
    channelTypeInactiveText: hslToHex(
      h + 30,
      clampS(0.35, 18, 30),
      clampL(0.95, 34, 42),
    ),

    // Scrollbars - Navigation Sidebar
    scrollbarNavThumb: hslToHex(
      h + 30,
      clampS(1.0, 55, 75),
      clampL(1.5, 56, 64),
    ),
    scrollbarNavThumbHover: hslToHex(
      h + 30,
      clampS(1.07, 60, 80),
      clampL(1.3, 48, 56),
    ),

    // Scrollbars - Main (Feed + Chat)
    scrollbarMainThumb: hslToHex(
      h + 30,
      clampS(1.07, 60, 80),
      clampL(1.45, 54, 62),
    ),
    scrollbarMainThumbHover: hslToHex(
      h + 30,
      clampS(1.15, 65, 85),
      clampL(1.25, 46, 54),
    ),

    // App Settings button - light mode (más claro)
    appSettingsHover: hslToHex(
      h + 31,
      clampS(1.0, 55, 72),
      clampL(1.55, 58, 66),
    ),

    // Custom User Button - light mode
    accentCustomUserButton: hslToHex(
      h + 32,
      clampS(1.1, 60, 78),
      clampL(1.45, 54, 62),
    ),

    // Tab hover - light mode
    bgTabHover: hslToHex(h + 30, clampS(0.85, 48, 65), clampL(1.55, 58, 66)),

    // Reply preview border - mismo color que buttonPrimary adaptado (light)
    borderAccentItemReplyPreview: hslToHex(
      h + 28,
      clampS(1.0, 55, 72),
      clampL(1.45, 54, 62),
    ),

    // Active channel border - mismo color que buttonPrimary adaptado (light)
    borderAccentActiveChannel: hslToHex(
      h + 28,
      clampS(1.0, 55, 72),
      clampL(1.45, 54, 62),
    ),

    // Edit form background - light mode
    bgEditForm: hslToHex(h + 33, clampS(1.2, 60, 85), clampL(2.1, 80, 90)),

    // Notification / Unread indicators - light mode (TODO: refinar)
    notificationBg: hslToHex(
      h + 180,
      clampS(1.1, 65, 80),
      clampL(0.72, 24, 35),
    ),
    unreadBg: hslToHex(h + 180, clampS(0.6, 38, 55), clampL(1.87, 70, 78)),
  };
}

/**
 * Genera el CSS string de un degradado
 */
export function generateGradientCSS(config: GradientConfig): string {
  const { colors, angle, type } = config;

  if (colors.length < 2) {
    const firstColor = colors[0];
    if (!firstColor) return "transparent";
    return typeof firstColor === "string" ? firstColor : firstColor.color;
  }

  // Generar stops con posiciones
  const stops = colors
    .map((colorItem, index) => {
      if (typeof colorItem === "string") {
        // Si es un string simple, calcular posición equidistante
        const position = (index / (colors.length - 1)) * 100;
        return `${colorItem} ${position}%`;
      } else {
        // Si es un GradientColorStop, usar la posición especificada
        return `${colorItem.color} ${colorItem.position}%`;
      }
    })
    .join(", ");

  if (type === "radial") {
    return `radial-gradient(circle at center, ${stops})`;
  }

  return `linear-gradient(${angle}deg, ${stops})`;
}

function generateNormalizedGradientCSS(config: GradientConfig): string {
  const { colors, angle, type } = config;

  if (colors.length < 2) {
    const firstColor = colors[0];
    if (!firstColor) return "transparent";
    return typeof firstColor === "string" ? firstColor : firstColor.color;
  }

  const stops = buildThemeGradientStopsCss(colors);

  if (type === "radial") {
    return `radial-gradient(circle at center, ${stops})`;
  }

  return `linear-gradient(${angle}deg, ${stops})`;
}

/**
 * Valida un color stop del degradado
 */
function isValidGradientColorStop(item: unknown): boolean {
  if (typeof item === "string") {
    return /^#[0-9A-Fa-f]{6}$/.test(item);
  }

  if (item && typeof item === "object") {
    const stop = item as Record<string, unknown>;
    return (
      typeof stop.color === "string" &&
      /^#[0-9A-Fa-f]{6}$/.test(stop.color) &&
      typeof stop.position === "number" &&
      stop.position >= 0 &&
      stop.position <= 100
    );
  }

  return false;
}

/**
 * Valida una configuración de degradado
 */
export function validateGradientConfig(
  config: unknown,
): config is GradientConfig {
  if (!config || typeof config !== "object") return false;

  const c = config as Record<string, unknown>;

  // Validar colors (soporta strings o GradientColorStop)
  if (!Array.isArray(c.colors)) return false;
  if (c.colors.length < 2 || c.colors.length > 4) return false;
  if (!c.colors.every(isValidGradientColorStop)) {
    return false;
  }

  // Validar angle
  if (typeof c.angle !== "number" || c.angle < 0 || c.angle > 360) return false;

  // Validar type
  if (c.type !== "linear" && c.type !== "radial") return false;

  return true;
}

/**
 * Valida un color hex
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Aplica las variables CSS del tema al documento
 */
export function applyThemeToDOM(colors: ThemeColors): void {
  const root = document.documentElement;

  root.style.setProperty("--theme-bg-primary", colors.bgPrimary);
  root.style.setProperty("--theme-bg-overlay-primary", colors.bgOverlayPrimary);
  root.style.setProperty(
    "--theme-bg-dropdown-menu-primary",
    colors.bgDropdownMenuPrimary,
  );
  root.style.setProperty("--theme-bg-secondary", colors.bgSecondary);
  root.style.setProperty("--theme-bg-tertiary", colors.bgTertiary);
  root.style.setProperty("--theme-bg-quaternary", colors.bgQuaternary);
  root.style.setProperty("--theme-bg-input-plus", colors.bgInputPlus);
  root.style.setProperty("--theme-bg-quinary", colors.bgQuinary);
  root.style.setProperty("--theme-bg-input", colors.bgInput);
  root.style.setProperty("--theme-accent-primary", colors.accentPrimary);
  root.style.setProperty("--theme-accent-light", colors.accentLight);
  root.style.setProperty("--theme-accent-hover", colors.accentHover);
  root.style.setProperty("--theme-border-primary", colors.borderPrimary);
  root.style.setProperty("--theme-border-secondary", colors.borderSecondary);
  root.style.setProperty("--theme-button-primary", colors.buttonPrimary);
  root.style.setProperty(
    "--theme-button-primary-active",
    colors.buttonPrimaryActive,
  );
  root.style.setProperty("--theme-button-hover", colors.buttonHover);
  root.style.setProperty("--theme-button-send-hover", colors.buttonSendHover);
  root.style.setProperty("--theme-text-accent", colors.textAccent);
  root.style.setProperty("--theme-text-muted", colors.textMuted);
  root.style.setProperty("--theme-text-light", colors.textLight);
  root.style.setProperty("--theme-text-subtle", colors.textSubtle);
  root.style.setProperty("--theme-text-primary", colors.textPrimary);
  root.style.setProperty("--theme-text-secondary", colors.textSecondary);
  root.style.setProperty("--theme-text-tertiary", colors.textTertiary);
  root.style.setProperty("--theme-text-inverse", colors.textInverse);
  root.style.setProperty("--theme-channel-bg", colors.channelBg);
  root.style.setProperty("--theme-channel-hover", colors.channelHover);
  root.style.setProperty("--theme-channel-active", colors.channelActive);
  root.style.setProperty("--theme-tooltip-bg", colors.tooltipBg);
  root.style.setProperty("--theme-avatar-fallback-bg", colors.avatarFallbackBg);
  root.style.setProperty("--theme-picker-bg", colors.pickerBg);
  root.style.setProperty("--theme-picker-border", colors.pickerBorder);
  root.style.setProperty("--theme-menu-hover", colors.menuHover);
  root.style.setProperty("--theme-menu-accent-text", colors.menuAccentText);
  root.style.setProperty("--theme-nav-action-bg", colors.navActionBg);
  root.style.setProperty("--theme-nav-action-hover", colors.navActionHover);
  root.style.setProperty("--theme-add-friend-icon", colors.addFriendIcon);
  root.style.setProperty("--theme-add-friend-hover", colors.addFriendHover);
  root.style.setProperty("--theme-text-muted-alt", colors.textMutedAlt);
  root.style.setProperty("--theme-tab-active-bg", colors.tabActiveBg);
  root.style.setProperty("--theme-tab-button-bg", colors.tabButtonBg);
  root.style.setProperty("--theme-tab-button-hover", colors.tabButtonHover);
  root.style.setProperty(
    "--theme-community-tabs-fallback-bg",
    colors.communityTabsFallbackBg,
  );
  root.style.setProperty(
    "--theme-community-tabs-fallback-active-bg",
    colors.communityTabsFallbackActiveBg,
  );
  root.style.setProperty("--theme-toolbar-bg", colors.toolbarBg);
  root.style.setProperty("--theme-toolbar-icon", colors.toolbarIcon);
  root.style.setProperty("--theme-toolbar-border", colors.toolbarBorder);
  root.style.setProperty("--theme-dropdown-bg", colors.dropdownBg);
  root.style.setProperty("--theme-dropdown-border", colors.dropdownBorder);
  root.style.setProperty("--theme-dropdown-hover", colors.dropdownHover);
  root.style.setProperty("--theme-reaction-active-bg", colors.reactionActiveBg);
  root.style.setProperty(
    "--theme-reaction-active-border",
    colors.reactionActiveBorder,
  );
  root.style.setProperty(
    "--theme-reaction-active-text",
    colors.reactionActiveText,
  );
  root.style.setProperty("--theme-reaction-bg", colors.reactionBg);
  root.style.setProperty("--theme-reaction-border", colors.reactionBorder);
  root.style.setProperty("--theme-reaction-text", colors.reactionText);
  root.style.setProperty(
    "--theme-slot-discovery-icon",
    colors.slotDiscoveryIcon,
  );
  root.style.setProperty("--theme-slot-discovery-bg", colors.slotDiscoveryBg);
  root.style.setProperty(
    "--theme-slot-invitation-icon",
    colors.slotInvitationIcon,
  );
  root.style.setProperty("--theme-slot-invitation-bg", colors.slotInvitationBg);
  root.style.setProperty("--theme-slot-border", colors.slotBorder);
  root.style.setProperty("--theme-bg-modal", colors.bgModal);
  root.style.setProperty("--theme-bg-input-modal", colors.bgInputModal);
  root.style.setProperty("--theme-bg-cancel-button", colors.bgCancelButton);
  root.style.setProperty(
    "--theme-bg-cancel-button-hover",
    colors.bgCancelButtonHover,
  );
  root.style.setProperty("--theme-chat-input-icon", colors.chatInputIcon);
  root.style.setProperty(
    "--theme-chat-input-icon-hover",
    colors.chatInputIconHover,
  );
  root.style.setProperty(
    "--theme-chat-input-button-bg",
    colors.chatInputButtonBg,
  );
  root.style.setProperty(
    "--theme-chat-input-surface-bg",
    colors.chatInputSurfaceBg,
  );
  root.style.setProperty(
    "--theme-channel-type-active-border",
    colors.channelTypeActiveBorder,
  );
  root.style.setProperty(
    "--theme-channel-type-active-soft-bg",
    colors.channelTypeActiveSoftBg,
  );
  root.style.setProperty(
    "--theme-channel-type-active-bg",
    colors.channelTypeActiveBg,
  );
  root.style.setProperty(
    "--theme-channel-type-active-text",
    colors.channelTypeActiveText,
  );
  root.style.setProperty(
    "--theme-channel-type-inactive-bg",
    colors.channelTypeInactiveBg,
  );
  root.style.setProperty(
    "--theme-channel-type-inactive-border",
    colors.channelTypeInactiveBorder,
  );
  root.style.setProperty(
    "--theme-channel-type-inactive-hover-border",
    colors.channelTypeInactiveHoverBorder,
  );
  root.style.setProperty(
    "--theme-channel-type-inactive-text",
    colors.channelTypeInactiveText,
  );
  root.style.setProperty(
    "--theme-scrollbar-nav-thumb",
    colors.scrollbarNavThumb,
  );
  root.style.setProperty(
    "--theme-scrollbar-nav-thumb-hover",
    colors.scrollbarNavThumbHover,
  );
  root.style.setProperty(
    "--theme-scrollbar-main-thumb",
    colors.scrollbarMainThumb,
  );
  root.style.setProperty(
    "--theme-scrollbar-main-thumb-hover",
    colors.scrollbarMainThumbHover,
  );
  root.style.setProperty("--theme-app-settings-hover", colors.appSettingsHover);
  root.style.setProperty(
    "--theme-accent-custom-user-button",
    colors.accentCustomUserButton,
  );
  root.style.setProperty("--theme-bg-tab-hover", colors.bgTabHover);
  root.style.setProperty(
    "--theme-border-accent-item-reply-preview",
    colors.borderAccentItemReplyPreview,
  );
  root.style.setProperty(
    "--theme-border-accent-active-channel",
    colors.borderAccentActiveChannel,
  );
  root.style.setProperty("--theme-bg-edit-form", colors.bgEditForm);
  root.style.setProperty("--theme-notification-bg", colors.notificationBg);
  root.style.setProperty("--theme-unread-bg", colors.unreadBg);
}

/**
 * Convierte ThemeColors a un objeto de variables CSS listas para inyectar
 * como `style` inline en un elemento (scope local, no toca el DOM global).
 */
export function themeColorsToCssVars(
  colors: ThemeColors,
): Record<string, string> {
  return {
    "--theme-bg-primary": colors.bgPrimary,
    "--theme-bg-overlay-primary": colors.bgOverlayPrimary,
    "--theme-bg-dropdown-menu-primary": colors.bgDropdownMenuPrimary,
    "--theme-bg-secondary": colors.bgSecondary,
    "--theme-bg-tertiary": colors.bgTertiary,
    "--theme-bg-quaternary": colors.bgQuaternary,
    "--theme-bg-input-plus": colors.bgInputPlus,
    "--theme-bg-quinary": colors.bgQuinary,
    "--theme-bg-input": colors.bgInput,
    "--theme-accent-primary": colors.accentPrimary,
    "--theme-accent-light": colors.accentLight,
    "--theme-accent-hover": colors.accentHover,
    "--theme-border-primary": colors.borderPrimary,
    "--theme-border-secondary": colors.borderSecondary,
    "--theme-button-primary": colors.buttonPrimary,
    "--theme-button-primary-active": colors.buttonPrimaryActive,
    "--theme-button-hover": colors.buttonHover,
    "--theme-button-send-hover": colors.buttonSendHover,
    "--theme-text-accent": colors.textAccent,
    "--theme-text-muted": colors.textMuted,
    "--theme-text-light": colors.textLight,
    "--theme-text-subtle": colors.textSubtle,
    "--theme-text-primary": colors.textPrimary,
    "--theme-text-secondary": colors.textSecondary,
    "--theme-text-tertiary": colors.textTertiary,
    "--theme-text-inverse": colors.textInverse,
    "--theme-channel-bg": colors.channelBg,
    "--theme-channel-hover": colors.channelHover,
    "--theme-channel-active": colors.channelActive,
    "--theme-tooltip-bg": colors.tooltipBg,
    "--theme-avatar-fallback-bg": colors.avatarFallbackBg,
    "--theme-picker-bg": colors.pickerBg,
    "--theme-picker-border": colors.pickerBorder,
    "--theme-menu-hover": colors.menuHover,
    "--theme-menu-accent-text": colors.menuAccentText,
    "--theme-nav-action-bg": colors.navActionBg,
    "--theme-nav-action-hover": colors.navActionHover,
    "--theme-add-friend-icon": colors.addFriendIcon,
    "--theme-add-friend-hover": colors.addFriendHover,
    "--theme-text-muted-alt": colors.textMutedAlt,
    "--theme-tab-active-bg": colors.tabActiveBg,
    "--theme-tab-button-bg": colors.tabButtonBg,
    "--theme-tab-button-hover": colors.tabButtonHover,
    "--theme-community-tabs-fallback-bg": colors.communityTabsFallbackBg,
    "--theme-community-tabs-fallback-active-bg":
      colors.communityTabsFallbackActiveBg,
    "--theme-toolbar-bg": colors.toolbarBg,
    "--theme-toolbar-icon": colors.toolbarIcon,
    "--theme-toolbar-border": colors.toolbarBorder,
    "--theme-dropdown-bg": colors.dropdownBg,
    "--theme-dropdown-border": colors.dropdownBorder,
    "--theme-dropdown-hover": colors.dropdownHover,
    "--theme-reaction-active-bg": colors.reactionActiveBg,
    "--theme-reaction-active-border": colors.reactionActiveBorder,
    "--theme-reaction-active-text": colors.reactionActiveText,
    "--theme-reaction-bg": colors.reactionBg,
    "--theme-reaction-border": colors.reactionBorder,
    "--theme-reaction-text": colors.reactionText,
    "--theme-slot-discovery-icon": colors.slotDiscoveryIcon,
    "--theme-slot-discovery-bg": colors.slotDiscoveryBg,
    "--theme-slot-invitation-icon": colors.slotInvitationIcon,
    "--theme-slot-invitation-bg": colors.slotInvitationBg,
    "--theme-slot-border": colors.slotBorder,
    "--theme-bg-modal": colors.bgModal,
    "--theme-bg-input-modal": colors.bgInputModal,
    "--theme-bg-cancel-button": colors.bgCancelButton,
    "--theme-bg-cancel-button-hover": colors.bgCancelButtonHover,
    "--theme-chat-input-icon": colors.chatInputIcon,
    "--theme-chat-input-icon-hover": colors.chatInputIconHover,
    "--theme-chat-input-button-bg": colors.chatInputButtonBg,
    "--theme-chat-input-surface-bg": colors.chatInputSurfaceBg,
    "--theme-channel-type-active-border": colors.channelTypeActiveBorder,
    "--theme-channel-type-active-soft-bg": colors.channelTypeActiveSoftBg,
    "--theme-channel-type-active-bg": colors.channelTypeActiveBg,
    "--theme-channel-type-active-text": colors.channelTypeActiveText,
    "--theme-channel-type-inactive-bg": colors.channelTypeInactiveBg,
    "--theme-channel-type-inactive-border": colors.channelTypeInactiveBorder,
    "--theme-channel-type-inactive-hover-border":
      colors.channelTypeInactiveHoverBorder,
    "--theme-channel-type-inactive-text": colors.channelTypeInactiveText,
    "--theme-scrollbar-nav-thumb": colors.scrollbarNavThumb,
    "--theme-scrollbar-nav-thumb-hover": colors.scrollbarNavThumbHover,
    "--theme-scrollbar-main-thumb": colors.scrollbarMainThumb,
    "--theme-scrollbar-main-thumb-hover": colors.scrollbarMainThumbHover,
    "--theme-app-settings-hover": colors.appSettingsHover,
    "--theme-accent-custom-user-button": colors.accentCustomUserButton,
    "--theme-bg-tab-hover": colors.bgTabHover,
    "--theme-border-accent-item-reply-preview":
      colors.borderAccentItemReplyPreview,
    "--theme-border-accent-active-channel": colors.borderAccentActiveChannel,
    "--theme-bg-edit-form": colors.bgEditForm,
    "--theme-notification-bg": colors.notificationBg,
    "--theme-unread-bg": colors.unreadBg,
  };
}

/**
 * Aplica el degradado de fondo al documento
 */
export function applyGradientToDOM(gradient: GradientConfig | null): void {
  const root = document.documentElement;

  if (gradient) {
    root.style.setProperty(
      "--theme-background-gradient",
      generateNormalizedGradientCSS(gradient),
    );
    root.style.setProperty("--theme-has-gradient", "1");
    root.dataset.themeGradient = "true";
  } else {
    root.style.removeProperty("--theme-background-gradient");
    root.style.setProperty("--theme-has-gradient", "0");
    root.dataset.themeGradient = "false";
  }
}

/**
 * Mapa de propiedades con su nivel de alfa individual cuando hay degradado activo
 * Valores más bajos = más transparente (más visible el degradado)
 * Valores más altos = más opaco (menos visible el degradado)
 *
 * TODAS las variables de ThemeColors deben estar incluidas aquí
 */
const BACKGROUND_ALPHA_MAP: Record<string, number> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUNDS - Muy transparentes para ver el degradado
  // ═══════════════════════════════════════════════════════════════════════════
  bgPrimary: 0.2,
  bgOverlayPrimary: 1,
  bgSecondary: 0.2,
  bgTertiary: 0.55,
  bgQuaternary: 0.5,
  bgInputPlus: 1, // Siempre opaco, incluso con degradado
  bgQuinary: 0.5,
  bgInput: 0.7,

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCENTS - Semi-transparentes para mantener identidad de color
  // ═══════════════════════════════════════════════════════════════════════════
  accentPrimary: 0.85,
  accentLight: 0.85,
  accentHover: 0.85,

  // ═══════════════════════════════════════════════════════════════════════════
  // BORDERS - Ligeramente transparentes
  // ═══════════════════════════════════════════════════════════════════════════
  borderPrimary: 0.8,
  borderSecondary: 0.8,

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTONS - Opacos para mantener legibilidad y contraste
  // ═══════════════════════════════════════════════════════════════════════════
  buttonPrimary: 0.35,
  buttonPrimaryActive: 0.35,
  buttonHover: 0.35,
  buttonSendHover: 1,

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT - Muy opacos para legibilidad
  // ═══════════════════════════════════════════════════════════════════════════
  textAccent: 0.95,
  textMuted: 0.9,
  textLight: 0.95,
  textSubtle: 0.9,
  textPrimary: 1.0, // Siempre opaco
  textSecondary: 0.9,
  textTertiary: 0.85,
  textInverse: 1.0, // Siempre opaco

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNELS
  // ═══════════════════════════════════════════════════════════════════════════
  channelBg: 0.5,
  channelHover: 0.55,
  channelActive: 0.6,

  // ═══════════════════════════════════════════════════════════════════════════
  // UI ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  tooltipBg: 0.85,
  avatarFallbackBg: 0.7,
  pickerBg: 0.8,
  pickerBorder: 0.75,
  menuHover: 0.6,
  menuAccentText: 0.95,
  navActionBg: 0.6,
  navActionHover: 0.65,
  addFriendIcon: 0.9,
  addFriendHover: 0.85,
  textMutedAlt: 0.85,
  tabActiveBg: 0.65,
  tabButtonBg: 0.7,
  tabButtonHover: 0.75,

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT TOOLBAR
  // ═══════════════════════════════════════════════════════════════════════════
  toolbarBg: 0.7,
  toolbarIcon: 0.9,
  toolbarBorder: 0.7,

  // ═══════════════════════════════════════════════════════════════════════════
  // DROPDOWN MENU
  // ═══════════════════════════════════════════════════════════════════════════
  dropdownBg: 0.85,
  dropdownBorder: 0.75,
  dropdownHover: 0.7,

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  reactionActiveBg: 0.7,
  reactionActiveBorder: 0.75,
  reactionActiveText: 0.95,
  reactionBg: 0.7,
  reactionBorder: 0.75,
  reactionText: 0.95,

  // ═══════════════════════════════════════════════════════════════════════════
  // SLOT AVATAR - Colores semánticos, mantienen algo de opacidad
  // ═══════════════════════════════════════════════════════════════════════════
  slotDiscoveryIcon: 0.9,
  slotDiscoveryBg: 0.8, // Ya tiene alfa en el valor
  slotInvitationIcon: 0.9,
  slotInvitationBg: 0.8, // Ya tiene alfa en el valor
  slotBorder: 0.8, // Ya tiene alfa en el valor

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL/INPUTS - Modales siempre opacos
  // ═══════════════════════════════════════════════════════════════════════════
  bgModal: 1.0, // Siempre opaco - modales nunca transparentes
  bgInputModal: 0.75,
  bgCancelButton: 0.7,
  bgCancelButtonHover: 0.75,

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT INPUT ICONS
  // ═══════════════════════════════════════════════════════════════════════════
  chatInputIcon: 0.9,
  chatInputIconHover: 0.85,
  chatInputButtonBg: 0.82,
  chatInputSurfaceBg: 0.92,

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL TYPE BUTTONS (Text/Voice selector)
  // ═══════════════════════════════════════════════════════════════════════════
  channelTypeActiveBorder: 0.85,
  channelTypeActiveSoftBg: 0.85,
  channelTypeActiveBg: 1.0, // Ya tiene alfa en el valor
  channelTypeActiveText: 0.95,
  channelTypeInactiveBg: 0.7,
  channelTypeInactiveBorder: 0.7,
  channelTypeInactiveHoverBorder: 0.75,
  channelTypeInactiveText: 0.9,

  // ═══════════════════════════════════════════════════════════════════════════
  // SCROLLBARS
  // ═══════════════════════════════════════════════════════════════════════════
  scrollbarNavThumb: 0.7,
  scrollbarNavThumbHover: 0.75,
  scrollbarMainThumb: 0.7,
  scrollbarMainThumbHover: 0.75,

  // ═══════════════════════════════════════════════════════════════════════════
  // APP SETTINGS BUTTON
  // ═══════════════════════════════════════════════════════════════════════════
  appSettingsHover: 0.85,

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM USER BUTTON
  // ═══════════════════════════════════════════════════════════════════════════
  accentCustomUserButton: 0.9,

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB HOVER (Settings sidebars)
  // ═══════════════════════════════════════════════════════════════════════════
  bgTabHover: 0.7,

  // ═══════════════════════════════════════════════════════════════════════════
  // REPLY PREVIEW BORDER
  // ═══════════════════════════════════════════════════════════════════════════
  borderAccentItemReplyPreview: 1.0,

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE CHANNEL BORDER
  // ═══════════════════════════════════════════════════════════════════════════
  borderAccentActiveChannel: 1.0,

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT FORM BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════════
  bgEditForm: 1.0,

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION / UNREAD INDICATORS - Siempre opacos (no deben transparentarse)
  // ═══════════════════════════════════════════════════════════════════════════
  notificationBg: 1.0,
  unreadBg: 1.0,
};

/**
 * Aplica transparencia a las variables de fondo cuando hay degradado activo
 * Cada propiedad tiene su propio nivel de alfa definido en BACKGROUND_ALPHA_MAP
 */
export function applyTransparencyToBackgrounds(
  colors: ThemeColors,
): ThemeColors {
  const transparentColors = { ...colors };

  for (const [prop, alphaLevel] of Object.entries(BACKGROUND_ALPHA_MAP)) {
    const value = colors[prop as keyof ThemeColors];
    if (typeof value === "string") {
      // Si ya tiene alfa (hsla, rgba), ajustamos el alfa
      if (value.startsWith("hsla(") || value.startsWith("rgba(")) {
        // Extraer y reemplazar el alfa existente
        const match = value.match(/,\s*([\d.]+)\s*\)$/);
        if (match) {
          const currentAlpha = parseFloat(match[1]);
          const newAlpha = Math.min(currentAlpha, alphaLevel);
          (transparentColors as Record<string, string>)[prop] = value.replace(
            /,\s*[\d.]+\s*\)$/,
            `, ${newAlpha})`,
          );
        }
      }
      // Si es hex, convertir a rgba
      else if (value.startsWith("#")) {
        (transparentColors as Record<string, string>)[prop] = hexToRgba(
          value,
          alphaLevel,
        );
      }
    }
  }

  return transparentColors;
}

/**
 * Remueve todas las variables CSS del tema
 */
export function clearThemeFromDOM(): void {
  const root = document.documentElement;

  const vars = [
    "--theme-bg-primary",
    "--theme-bg-secondary",
    "--theme-bg-tertiary",
    "--theme-bg-quaternary",
    "--theme-bg-quinary",
    "--theme-bg-input",
    "--theme-accent-primary",
    "--theme-accent-light",
    "--theme-accent-hover",
    "--theme-border-primary",
    "--theme-border-secondary",
    "--theme-button-primary",
    "--theme-button-primary-active",
    "--theme-button-hover",
    "--theme-chat-input-button-bg",
    "--theme-chat-input-surface-bg",
    "--theme-channel-type-active-soft-bg",
    "--theme-text-accent",
    "--theme-text-muted",
    "--theme-text-light",
    "--theme-text-subtle",
    "--theme-channel-bg",
    "--theme-channel-hover",
    "--theme-tooltip-bg",
    "--theme-avatar-fallback-bg",
    "--theme-background-gradient",
    "--theme-has-gradient",
  ];

  vars.forEach((v) => root.style.removeProperty(v));
  delete root.dataset.themeGradient;
}
