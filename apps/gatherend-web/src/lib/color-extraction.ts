/**
 * Color extraction utilities for dynamic theming based on images.
 *
 * Used by discovery cards to extract dominant colors from board/community images
 * and generate derived colors for UI elements (badges, buttons, etc).
 */

// EXTRACTION FUNCTIONS

/**
 * Extract color from the corner of an image (best for Dicebear avatars with solid backgrounds)
 */
export function extractCornerColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  try {
    const cornerPixel = ctx.getImageData(5, 5, 1, 1).data;
    let r = cornerPixel[0];
    let g = cornerPixel[1];
    let b = cornerPixel[2];

    // Desaturate and darken for card background
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const desaturationFactor = 0.4;
    r = Math.round(r + (gray - r) * desaturationFactor);
    g = Math.round(g + (gray - g) * desaturationFactor);
    b = Math.round(b + (gray - b) * desaturationFactor);

    const darkenFactor = 0.35;
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

/**
 * Extract dominant color from an image using color quantization.
 * Best for real photos where you want the most prominent color.
 */
export function extractDominantColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Use small image for better performance (max 50x50)
  const maxSize = 50;
  const scale = Math.min(
    maxSize / img.naturalWidth,
    maxSize / img.naturalHeight,
    1,
  );
  canvas.width = Math.floor(img.naturalWidth * scale);
  canvas.height = Math.floor(img.naturalHeight * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Map of quantized colors (reduce to 32 levels per channel = 32768 possible colors)
    const colorMap = new Map<
      string,
      { count: number; r: number; g: number; b: number }
    >();
    const quantize = (v: number) => Math.floor(v / 8) * 8;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Ignore transparent pixels
      if (a < 128) continue;

      // Ignore very dark or very light pixels (typical backgrounds)
      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 240) continue;

      const qr = quantize(r);
      const qg = quantize(g);
      const qb = quantize(b);
      const key = `${qr},${qg},${qb}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        colorMap.set(key, { count: 1, r, g, b });
      }
    }

    // Find most frequent color
    let dominantColor = { count: 0, r: 0, g: 0, b: 0 };
    for (const color of colorMap.values()) {
      if (color.count > dominantColor.count) {
        dominantColor = color;
      }
    }

    if (dominantColor.count === 0) return null;

    // Calculate real average of the dominant cluster
    let r = Math.round(dominantColor.r / dominantColor.count);
    let g = Math.round(dominantColor.g / dominantColor.count);
    let b = Math.round(dominantColor.b / dominantColor.count);

    // Desaturate and darken for card background
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const desaturationFactor = 0.4;
    r = Math.round(r + (gray - r) * desaturationFactor);
    g = Math.round(g + (gray - g) * desaturationFactor);
    b = Math.round(b + (gray - b) * desaturationFactor);

    const darkenFactor = 0.35;
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

// COLOR PARSING

/**
 * Parse RGB string to object {r, g, b}
 * Supports "rgb(r, g, b)" and "#rrggbb" formats
 */
export function parseRgb(
  color: string,
): { r: number; g: number; b: number } | null {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }
  const hexMatch = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }
  return null;
}

// DERIVED COLORS

export interface ButtonColors {
  buttonBg: string;
  buttonHoverBg: string;
  buttonText: string;
}

export interface DerivedColors extends ButtonColors {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  reliefBorder: string;
  reliefBorderLight: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}

const DEFAULT_BUTTON_COLORS: ButtonColors = {
  buttonBg: "var(--theme-accent-primary)",
  buttonHoverBg: "var(--theme-accent-hover)",
  buttonText: "#ffffff",
};

const DEFAULT_DERIVED_COLORS: DerivedColors = {
  ...DEFAULT_BUTTON_COLORS,
  badgeBg: "rgba(255, 255, 255, 0.1)",
  badgeText: "rgba(255, 255, 255, 0.8)",
  badgeBorder: "rgba(255, 255, 255, 0.1)",
  reliefBorder: "rgba(0, 0, 0, 0.35)",
  reliefBorderLight: "rgba(255, 255, 255, 0.12)",
  scrollbarThumb: "rgba(255, 255, 255, 0.15)",
  scrollbarThumbHover: "rgba(255, 255, 255, 0.25)",
};

/**
 * Generate button colors from a dominant color.
 * Used by CommunityCard.
 */
export function getButtonColors(dominantColor: string): ButtonColors {
  const rgb = parseRgb(dominantColor);
  if (!rgb) {
    return DEFAULT_BUTTON_COLORS;
  }

  const { r, g, b } = rgb;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  const boostFactor = 2.5;
  const targetLightness = 120;
  const adjustment = targetLightness - lightness;

  let btnR = Math.round(
    Math.min(255, Math.max(0, r * boostFactor + adjustment)),
  );
  let btnG = Math.round(
    Math.min(255, Math.max(0, g * boostFactor + adjustment)),
  );
  let btnB = Math.round(
    Math.min(255, Math.max(0, b * boostFactor + adjustment)),
  );

  // Ensure it's not too dark
  const btnBrightness = (btnR + btnG + btnB) / 3;
  if (btnBrightness < 80) {
    const boost = 80 - btnBrightness;
    btnR = Math.min(255, btnR + boost);
    btnG = Math.min(255, btnG + boost);
    btnB = Math.min(255, btnB + boost);
  }

  const buttonBg = `rgb(${btnR}, ${btnG}, ${btnB})`;
  const buttonHoverBg = `rgb(${Math.min(btnR + 20, 255)}, ${Math.min(
    btnG + 20,
    255,
  )}, ${Math.min(btnB + 20, 255)})`;

  // Button text: white or black based on contrast
  const buttonLuminance = (0.299 * btnR + 0.587 * btnG + 0.114 * btnB) / 255;
  const buttonText = buttonLuminance > 0.5 ? "#1a1a1a" : "#ffffff";

  return {
    buttonBg,
    buttonHoverBg,
    buttonText,
  };
}

/**
 * Generate all derived colors from a dominant color.
 * Used by discovery community cards for badges, buttons, scrollbars, etc.
 */
export function getDerivedColors(dominantColor: string): DerivedColors {
  const rgb = parseRgb(dominantColor);
  if (!rgb) {
    return DEFAULT_DERIVED_COLORS;
  }

  const { r, g, b } = rgb;

  // Badge: lighter and more transparent version of dominant color
  const badgeBg = `rgba(${Math.min(r + 40, 255)}, ${Math.min(
    g + 40,
    255,
  )}, ${Math.min(b + 40, 255)}, 0.25)`;
  const badgeText = `rgb(${Math.min(r + 120, 255)}, ${Math.min(
    g + 120,
    255,
  )}, ${Math.min(b + 120, 255)})`;
  const badgeBorder = `rgba(${Math.min(r + 60, 255)}, ${Math.min(
    g + 60,
    255,
  )}, ${Math.min(b + 60, 255)}, 0.3)`;

  // Relief border (old "table UI" feel): keep the same hue and darken slightly.
  // With right/bottom-only borders, this reads as a classic "shadow" edge.
  //
  // Keep the delta small so it doesn't become a harsh outline; for very dark
  // backgrounds we darken even less.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const darkenT =
    luma < 0.25 ? 0.12 : luma < 0.4 ? 0.16 : luma < 0.6 ? 0.22 : 0.28;

  const reliefR = Math.round(r * (1 - darkenT));
  const reliefG = Math.round(g * (1 - darkenT));
  const reliefB = Math.round(b * (1 - darkenT));
  const reliefBorder = `rgba(${reliefR}, ${reliefG}, ${reliefB}, 0.9)`;

  // Light relief edge for "raised table" look (top border highlight).
  // Keep it subtle; for darker backgrounds we can brighten a bit more.
  const lightenT =
    luma < 0.25 ? 0.24 : luma < 0.4 ? 0.18 : luma < 0.6 ? 0.12 : 0.08;
  const reliefLightR = Math.round(r + (255 - r) * lightenT);
  const reliefLightG = Math.round(g + (255 - g) * lightenT);
  const reliefLightB = Math.round(b + (255 - b) * lightenT);
  const reliefBorderLight = `rgba(${reliefLightR}, ${reliefLightG}, ${reliefLightB}, 0.85)`;

  // Button colors
  const buttonColors = getButtonColors(dominantColor);

  // Scrollbar colors
  const scrollbarThumb = `rgba(${Math.min(r + 80, 255)}, ${Math.min(
    g + 80,
    255,
  )}, ${Math.min(b + 80, 255)}, 0.4)`;
  const scrollbarThumbHover = `rgba(${Math.min(r + 100, 255)}, ${Math.min(
    g + 100,
    255,
  )}, ${Math.min(b + 100, 255)}, 0.6)`;

  return {
    badgeBg,
    badgeText,
    badgeBorder,
    reliefBorder,
    reliefBorderLight,
    ...buttonColors,
    scrollbarThumb,
    scrollbarThumbHover,
  };
}
