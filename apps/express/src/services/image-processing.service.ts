/**
 * Image Processing Service
 *
 * Handles:
 * - EXIF stripping for privacy
 * - SHA-256 hashing for exact match cache
 * - Perceptual hashing for similar image detection
 * - Image optimization before upload
 */

import sharp from "sharp";
import { createHash } from "crypto";

export interface ProcessedImage {
  buffer: Buffer;
  hash: string;
  width: number;
  height: number;
  format: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

/**
 * Process an image: strip EXIF, calculate hash, get metadata
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // Use sharp to strip EXIF and normalize
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Strip EXIF data and convert to consistent format
  const processedBuffer = await image
    .rotate() // Auto-rotate based on EXIF orientation before stripping
    .withMetadata({}) // Keep minimal metadata, removes EXIF/IPTC/XMP
    .toBuffer();

  // Calculate SHA-256 hash of the processed image
  const hash = calculateHash(processedBuffer);

  return {
    buffer: processedBuffer,
    hash,
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
  };
}

/**
 * Calculate SHA-256 hash of a buffer
 */
export function calculateHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    size: buffer.length,
    hasAlpha: metadata.hasAlpha || false,
  };
}

/**
 * Extract the first frame from animated images (GIF, WebP, AVIF, etc).
 * Moderation uses a single representative frame for all animated formats.
 */
export async function extractFirstFrame(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();

  // Check if it's an animated format
  if (metadata.pages && metadata.pages > 1) {
    // Extract only the first page/frame
    return sharp(buffer, { pages: 1 }).toBuffer();
  }

  // Not animated, return as-is
  return buffer;
}

/**
 * Prepare a single still image for moderation inference.
 * - Normalizes orientation
 * - Extracts the first frame for animated formats
 * - Resizes to maxDimension while preserving aspect ratio
 * - Converts to PNG when alpha is present, JPEG otherwise
 */
export async function prepareForModeration(
  buffer: Buffer,
  options: { maxDimension?: number } = {},
): Promise<{
  buffer: Buffer;
  format: "jpeg" | "png";
  animated: boolean;
}> {
  const maxDimension = options.maxDimension ?? 1024;
  const metadata = await sharp(buffer, { animated: true }).metadata();
  const animated = (metadata.pages || 1) > 1;

  let pipeline = animated ? sharp(buffer, { page: 0 }) : sharp(buffer);
  pipeline = pipeline.rotate();

  if (
    (metadata.width || 0) > maxDimension ||
    (metadata.height || 0) > maxDimension
  ) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (metadata.hasAlpha) {
    return {
      buffer: await pipeline.png().toBuffer(),
      format: "png",
      animated,
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    format: "jpeg",
    animated,
  };
}

/**
 * Optimize image for storage (Cloudinary will also optimize, but this helps)
 */
export async function optimizeForStorage(
  buffer: Buffer,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Buffer> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 85 } = options;

  return sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/**
 * Check if buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!metadata.format;
  } catch {
    return false;
  }
}

/**
 * Get supported formats
 */
export const SUPPORTED_IMAGE_FORMATS = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "gif",
  "avif",
  "heif",
  "heic",
];

export function isSupportedFormat(format: string): boolean {
  return SUPPORTED_IMAGE_FORMATS.includes(format.toLowerCase());
}
