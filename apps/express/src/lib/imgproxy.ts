/**
 * imgproxy URL Signing Library
 *
 * Generates signed URLs for imgproxy transformations.
 * Used to transform images stored in S3-compatible storage on-the-fly.
 */

import crypto from "crypto";

const IMGPROXY_URL = process.env.IMGPROXY_URL || "";
const IMGPROXY_KEY = process.env.IMGPROXY_KEY || "";
const IMGPROXY_SALT = process.env.IMGPROXY_SALT || "";

/**
 * Sign an imgproxy path using HMAC-SHA256
 */
function signPath(path: string): string {
  if (!IMGPROXY_KEY || !IMGPROXY_SALT) {
    // If no keys configured, return unsigned (for development)
    return `insecure${path}`;
  }

  const key = Buffer.from(IMGPROXY_KEY, "hex");
  const salt = Buffer.from(IMGPROXY_SALT, "hex");

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(salt);
  hmac.update(path);

  const signature = hmac.digest("base64url");

  return `${signature}${path}`;
}

/**
 * Encode source URL for imgproxy
 */
function encodeSourceUrl(url: string): string {
  return Buffer.from(url).toString("base64url");
}

export interface TransformOptions {
  width?: number;
  height?: number;
  resize?: "fit" | "fill" | "auto";
  gravity?: "no" | "ce" | "sm" | "fp" | "face";
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
  page?: number; // For animated images, get specific frame
}

/**
 * Build imgproxy transformation string
 */
function buildTransformations(options: TransformOptions): string {
  const parts: string[] = [];

  // Resize type
  const resizeType = options.resize || "fit";
  const width = options.width || 0;
  const height = options.height || 0;

  if (width || height) {
    parts.push(`rs:${resizeType}:${width}:${height}`);
  }

  // Gravity (for fill resize)
  if (options.gravity) {
    parts.push(`g:${options.gravity}`);
  }

  // Quality
  if (options.quality) {
    parts.push(`q:${options.quality}`);
  }

  // Format
  if (options.format) {
    parts.push(`f:${options.format}`);
  }

  // Page
  if (options.page !== undefined) {
    parts.push(`pg:${options.page}`);
  }

  return parts.join("/");
}

/**
 * Generate a signed imgproxy URL
 *
 * @example
 * getImgproxyUrl("https://cdn.example.com/avatars/abc.jpg", { width: 256, height: 256, resize: "fill" })
 * // Returns: https://<IMGPROXY_URL>/SIGNATURE/rs:fill:256:256/plain/https://cdn.example.com/avatars/abc.jpg
 */
export function getImgproxyUrl(
  sourceUrl: string,
  options: TransformOptions = {},
): string {
  const transformations = buildTransformations(options);
  const encodedUrl = encodeSourceUrl(sourceUrl);

  // Build path: /transformations/encoded_url.extension
  const extension = options.format || "webp";
  const path = transformations
    ? `/${transformations}/${encodedUrl}.${extension}`
    : `/${encodedUrl}.${extension}`;

  const signedPath = signPath(path);

  return `${IMGPROXY_URL}/${signedPath}`;
}

/**
 * Preset transformations
 */
export const presets = {
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
      page: 1, // First frame for animated
    }),

  messageAttachment: (url: string) =>
    getImgproxyUrl(url, {
      width: 1920,
      height: 1080,
      resize: "fit",
      format: "webp",
      quality: 85,
    }),

  messageThumbnail: (url: string) =>
    getImgproxyUrl(url, {
      width: 400,
      height: 300,
      resize: "fit",
      format: "webp",
      quality: 75,
    }),
};

/**
 * Check if imgproxy is configured
 */
export function isImgproxyConfigured(): boolean {
  return !!IMGPROXY_URL;
}

export { IMGPROXY_URL };
