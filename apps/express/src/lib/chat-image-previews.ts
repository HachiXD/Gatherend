import { getImgproxyUrl } from "./imgproxy.js";

const _envHostnames = (process.env.MEDIA_ALLOWED_HOSTNAMES || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);
const ALLOWED_SOURCE_HOSTNAMES = new Set([
  ..._envHostnames,
  "res.cloudinary.com",
  "d1i5ye3mnngc0e.cloudfront.net",
]);

function canProxySourceUrl(sourceUrl: string): boolean {
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_SOURCE_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

type WithFile = {
  attachmentAsset?: {
    url?: string | null;
    mimeType?: string | null;
  } | null;
};

export type WithFilePreviews = {
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
};

const PREVIEW_OPTIONS = {
  width: 800,
  height: 600,
  resize: "fit" as const,
  format: "webp" as const,
  quality: 85,
};

export function attachFilePreviews<T extends WithFile>(
  item: T,
): T & WithFilePreviews {
  const assetUrl = item.attachmentAsset?.url ?? null;
  const assetMimeType = item.attachmentAsset?.mimeType ?? null;

  if (!assetUrl || !assetMimeType?.startsWith("image/")) {
    return { ...item, filePreviewUrl: null, fileStaticPreviewUrl: null };
  }

  if (!canProxySourceUrl(assetUrl)) {
    return { ...item, filePreviewUrl: null, fileStaticPreviewUrl: null };
  }

  // For animated formats: provide a guaranteed-static placeholder (JPEG).
  // For GIF we intentionally avoid generating an animated WebP preview because Next won't optimize it
  // and we want "static by default, animate on hover" behavior in the UI.
  const wantsStaticPreview =
    assetMimeType === "image/webp" ||
    assetMimeType === "image/gif" ||
    assetMimeType === "image/apng";

  const filePreviewUrl =
    assetMimeType === "image/gif"
      ? null
      : getImgproxyUrl(assetUrl, PREVIEW_OPTIONS);

  const fileStaticPreviewUrl = wantsStaticPreview
    ? getImgproxyUrl(assetUrl, {
        width: PREVIEW_OPTIONS.width,
        height: PREVIEW_OPTIONS.height,
        resize: PREVIEW_OPTIONS.resize,
        format: "jpeg",
        quality: 82,
      })
    : null;

  return { ...item, filePreviewUrl, fileStaticPreviewUrl };
}
