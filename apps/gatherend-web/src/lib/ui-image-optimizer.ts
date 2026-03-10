import type { TransformOptions } from "@/lib/imgproxy-utils";
import { canUseImgproxy } from "@/lib/imgproxy-utils";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";

function rewriteDicebearToWebp(url: string): string {
  try {
    const u = new URL(url);
    const dicebearHost = process.env.NEXT_PUBLIC_DICEBEAR_URL
      ? new URL(process.env.NEXT_PUBLIC_DICEBEAR_URL).hostname
      : null;
    if (!dicebearHost || u.hostname !== dicebearHost) return url;
    // Dicebear selects output format by path segment (e.g. `/.../png` vs `/.../webp`).
    // Query params like `format=webp` are ignored for `/png` (it still responds `image/png`).
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.toLowerCase();
    if (last === "png") {
      parts[parts.length - 1] = "webp";
      u.pathname = `/${parts.join("/")}`;
      u.searchParams.delete("format");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function getPathnameLower(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.split("?")[0].split("#")[0].toLowerCase();
  }
}

function isPotentiallyAnimatedByExtension(url: string): boolean {
  const p = getPathnameLower(url);
  return p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".apng");
}

function isStaticRasterByExtension(url: string): boolean {
  const p = getPathnameLower(url);
  return (
    p.endsWith(".jpg") ||
    p.endsWith(".jpeg") ||
    p.endsWith(".png") ||
    p.endsWith("/jpg") ||
    p.endsWith("/jpeg") ||
    p.endsWith("/png")
  );
}

function getSignedUiImageUrlViaExpress(
  src: string,
  opts: {
    w: number;
    h: number;
    q?: number;
    resize?: TransformOptions["resize"];
    gravity?: TransformOptions["gravity"];
  },
): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return src;

  const params = new URLSearchParams();
  params.set("src", src);
  params.set("w", String(opts.w));
  params.set("h", String(opts.h));
  params.set("q", String(opts.q ?? 82));
  params.set("fmt", "webp");
  params.set("rs", opts.resize ?? "fill");
  if (opts.gravity) params.set("g", opts.gravity);

  return `${apiUrl}/media/ui-image?${params.toString()}`;
}

export function getOptimizedStaticUiImageUrl(
  src: string,
  opts: {
    w: number;
    h: number;
    q?: number;
    resize?: TransformOptions["resize"];
    gravity?: TransformOptions["gravity"];
  },
): string {
  if (!src) return src;
  const normalized = rewriteDicebearToWebp(src);

  // Preserve existing "never animate" behavior for formats that might animate.
  if (isPotentiallyAnimatedByExtension(normalized)) {
    return getNeverAnimatedImageUrl(normalized, {
      w: opts.w,
      h: opts.h,
      q: opts.q,
      fmt: "webp",
    });
  }

  // Only re-encode static raster formats (jpg/jpeg/png). Other formats keep original.
  if (!isStaticRasterByExtension(normalized)) return normalized;
  if (!canUseImgproxy(normalized)) return normalized;

  // imgproxy requires signed URLs in production; do not generate insecure URLs in the browser.
  return getSignedUiImageUrlViaExpress(normalized, opts);
}
