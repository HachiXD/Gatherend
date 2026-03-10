/**
 * Cloudflare R2 Configuration
 *
 * R2 is S3-compatible storage with free egress and built-in CDN.
 * Used for all media storage (public and private content).
 *
 * CSAM scanning is handled at the Cloudflare proxy level (custom domain).
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Railway inyecta las variables de entorno automáticamente
if (process.env.NODE_ENV !== "production") {
  // Keep this file resilient to different working directories in dev.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../../.env"),
    path.resolve(process.cwd(), "apps/express/.env"),
    path.resolve(process.cwd(), "../apps/express/.env"),
    path.resolve(process.cwd(), "../../apps/express/.env"),
    path.resolve(process.cwd(), "../../../apps/express/.env"),
  ];

  const seen = new Set<string>();
  for (const p of candidatePaths) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
}

// R2 / S3-compatible configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_BUCKET = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

// S3_ENDPOINT overrides the default R2 endpoint, this is for MinIO or any S3-compatible storage to work
const s3Endpoint = process.env.S3_ENDPOINT
  ? process.env.S3_ENDPOINT
  : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Initialize S3-compatible client
const r2Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  // Required by MinIO
  forcePathStyle: !!process.env.S3_ENDPOINT,
});

// Legacy exports for backwards compatibility
const s3Client = r2Client;
const S3_BUCKET = R2_BUCKET;
const AWS_REGION = "auto";
const CLOUDFRONT_DOMAIN = R2_PUBLIC_URL.replace("https://", "");

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  // With S3_ENDPOINT set (MinIO, etc.), R2_ACCOUNT_ID is not needed
  if (process.env.S3_ENDPOINT) {
    return !!(
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      R2_BUCKET
    );
  }
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    R2_BUCKET &&
    R2_ACCOUNT_ID
  );
}

// Legacy alias
export const isS3Configured = isR2Configured;

/**
 * Get public URL for an R2 object
 */
export function getR2PublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback: construct URL from endpoint (MinIO) or R2 account ID
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT}/${R2_BUCKET}/${key}`;
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

// Legacy alias
export const getCloudFrontUrl = getR2PublicUrl;

export interface R2UploadOptions {
  buffer: Buffer;
  key: string;
  contentType: string;
  folder: string;
  bucketName?: string;
  contentDisposition?: string;
}

export interface R2UploadResult {
  success: boolean;
  url: string;
  key: string;
  error?: string;
}

// Legacy type aliases
export type S3UploadOptions = R2UploadOptions;
export type S3UploadResult = R2UploadResult;

/**
 * Upload a file to R2
 */
export async function uploadToR2(
  options: R2UploadOptions,
): Promise<R2UploadResult> {
  const { buffer, key, contentType, folder, bucketName, contentDisposition } =
    options;
  const fullKey = `${folder}/${key}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName || R2_BUCKET,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
      ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
      // Cache for 1 year (immutable content)
      CacheControl: "public, max-age=31536000, immutable",
    });

    await r2Client.send(command);

    return {
      success: true,
      url: getR2PublicUrl(fullKey),
      key: fullKey,
    };
  } catch (error) {
    console.error("[R2] Upload error:", error);
    return {
      success: false,
      url: "",
      key: fullKey,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Legacy alias
export const uploadToS3 = uploadToR2;

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error("[R2] Delete error:", error);
    return false;
  }
}

// Legacy alias
export const deleteFromS3 = deleteFromR2;

// Export R2 client and config
export { r2Client, R2_BUCKET, R2_PUBLIC_URL, R2_ACCOUNT_ID };

// Legacy exports for backwards compatibility
export { s3Client, S3_BUCKET, CLOUDFRONT_DOMAIN, AWS_REGION };
