/**
 * UI-only helpers for "never animate" image rendering.
 *
 * Some UI surfaces (nav icons, leftbar banner) should never animate, even if the
 * user uploaded an animated WebP/GIF/APNG. We achieve this by requesting a
 * static transform via Express -> imgproxy (first frame), which always results
 * in a non-animated image payload.
 */

const STORAGE_DOMAIN = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "";

function getPathnameLower(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    // Best-effort fallback for non-standard inputs.
    return url.split("?")[0].split("#")[0].toLowerCase();
  }
}

function isPotentiallyAnimatedByExtension(url: string): boolean {
  const p = getPathnameLower(url);
  return p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".apng");
}

function isStorageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === STORAGE_DOMAIN;
  } catch {
    return url.includes(STORAGE_DOMAIN);
  }
}

export function getNeverAnimatedImageUrl(
  src: string,
  opts: { w: number; h: number; q?: number; fmt?: "avif" | "webp" | "png" } = {
    w: 128,
    h: 128,
  },
): string {
  // Only proxy our own CDN assets. Other sources (Dicebear, Google, etc.) are static anyway.
  if (!src || !isStorageUrl(src)) return src;

  // Only force static transform for formats that can be animated.
  if (!isPotentiallyAnimatedByExtension(src)) return src;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return src;

  const q = opts.q ?? 82;
  const fmt = opts.fmt ?? "webp";
  return `${apiUrl}/media/sticker-static?src=${encodeURIComponent(
    src,
  )}&w=${opts.w}&h=${opts.h}&q=${q}&fmt=${fmt}`;
}
