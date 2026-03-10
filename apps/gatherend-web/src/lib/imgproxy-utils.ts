/**
 * Image URL Utilities
 *
 * Helper functions to transform images using imgproxy.
 *
 * NOTE: imgproxy should be configured with IMGPROXY_ALLOWED_SOURCES
 * instead of signature for frontend usage (simpler and secure enough).
 */

const IMGPROXY_URL =
  process.env.NEXT_PUBLIC_IMGPROXY_URL || "";
const STORAGE_DOMAIN = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "";

export function isStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    return u.hostname === STORAGE_DOMAIN;
  } catch {
    return false;
  }
}

export function isAnimatedFormat(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".webp") || lowerUrl.endsWith(".gif");
}

export function canUseImgproxy(url: string): boolean {
  return isStorageUrl(url);
}

export interface TransformOptions {
  width?: number;
  height?: number;
  resize?: "fit" | "fill" | "auto";
  gravity?: "no" | "ce" | "sm" | "fp" | "face";
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
  page?: number;
}

function buildTransformations(options: TransformOptions): string {
  const parts: string[] = [];

  const resizeType = options.resize || "fit";
  const width = options.width || 0;
  const height = options.height || 0;

  if (width || height) {
    parts.push(`rs:${resizeType}:${width}:${height}`);
  }

  if (options.gravity) {
    parts.push(`g:${options.gravity}`);
  }

  if (options.quality) {
    parts.push(`q:${options.quality}`);
  }

  if (options.format) {
    parts.push(`f:${options.format}`);
  }

  if (options.page !== undefined) {
    parts.push(`pg:${options.page}`);
  }

  return parts.join("/");
}

function base64UrlEncode(input: string): string {
  const base64 = btoa(input);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Generate an imgproxy URL (unsigned - relies on ALLOWED_SOURCES)
 */
export function getImgproxyUrl(
  sourceUrl: string,
  options: TransformOptions = {},
): string {
  if (!canUseImgproxy(sourceUrl)) {
    return sourceUrl;
  }

  const transformations = buildTransformations(options);
  const encodedUrl = base64UrlEncode(sourceUrl);
  const extension = options.format || "webp";

  const path = transformations
    ? `insecure/${transformations}/${encodedUrl}.${extension}`
    : `insecure/${encodedUrl}.${extension}`;

  return joinUrl(IMGPROXY_URL, path);
}

/**
 * Get static first frame from animated image
 */
export function getStaticFrameUrl(url: string): string {
  // For R2 URLs, use imgproxy
  if (isAnimatedFormat(url)) {
    return getImgproxyUrl(url, { page: 1 });
  }

  return url;
}

/**
 * Preset transformations
 */
export const imagePresets = {
  avatar: (url: string) =>
    getImgproxyUrl(url, {
      width: 256,
      height: 256,
      resize: "fill",
      gravity: "face",
      format: "webp",
      quality: 85,
    }),

  avatarSmall: (url: string) =>
    getImgproxyUrl(url, {
      width: 64,
      height: 64,
      resize: "fill",
      gravity: "face",
      format: "webp",
      quality: 80,
    }),

  banner: (url: string) =>
    getImgproxyUrl(url, {
      width: 1500,
      height: 500,
      resize: "fill",
      gravity: "sm",
      format: "webp",
      quality: 85,
    }),

  boardImage: (url: string) =>
    getImgproxyUrl(url, {
      width: 1200,
      height: 630,
      resize: "fill",
      gravity: "sm",
      format: "webp",
      quality: 85,
    }),

  boardThumbnail: (url: string) =>
    getImgproxyUrl(url, {
      width: 400,
      height: 210,
      resize: "fill",
      gravity: "sm",
      format: "webp",
      quality: 80,
    }),

  sticker: (url: string) =>
    getImgproxyUrl(url, {
      width: 512,
      height: 512,
      resize: "fit",
      format: "webp",
      quality: 90,
    }),

  stickerStatic: (url: string) =>
    getImgproxyUrl(url, {
      width: 512,
      height: 512,
      resize: "fit",
      format: "webp",
      quality: 90,
      page: 1,
    }),

  messageImage: (url: string) =>
    getImgproxyUrl(url, {
      width: 800,
      height: 600,
      resize: "fit",
      format: "webp",
      quality: 85,
    }),

  // Static first frame for formats that might be animated (e.g. WebP).
  // Uses the same constraints as messageImage to avoid giant previews.
  messageImageStatic: (url: string) =>
    getImgproxyUrl(url, {
      width: 800,
      height: 600,
      resize: "fit",
      format: "webp",
      quality: 85,
      page: 1,
    }),

  thumbnail: (url: string) =>
    getImgproxyUrl(url, {
      width: 200,
      height: 200,
      resize: "fill",
      gravity: "sm",
      format: "webp",
      quality: 75,
    }),
};
