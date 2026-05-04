/**
 * S3-compatible Object Storage Configuration
 *
 * Supports any S3-compatible provider (Cloudflare R2, MinIO, AWS S3, etc.).
 * Used for all media storage (public and private content).
 *
 * CSAM scanning is handled at the Cloudflare proxy level (custom domain).
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Railway inyecta las variables de entorno automáticamente
if (process.env.NODE_ENV !== "production") {
  // Keep this file resilient to different working directories in dev.
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

const STORAGE_ACCOUNT_ID = process.env.STORAGE_ACCOUNT_ID || "";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || "";
const STORAGE_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || "";

// S3_ENDPOINT overrides the auto-detected endpoint (for MinIO, AWS S3, etc.)
const s3Endpoint = process.env.S3_ENDPOINT
  ? process.env.S3_ENDPOINT
  : `https://${STORAGE_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const storageClient = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: s3Endpoint,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: !!process.env.S3_ENDPOINT,
});

export function isStorageConfigured(): boolean {
  if (process.env.S3_ENDPOINT) {
    return !!(
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY &&
      STORAGE_BUCKET
    );
  }
  return !!(
    process.env.STORAGE_ACCESS_KEY_ID &&
    process.env.STORAGE_SECRET_ACCESS_KEY &&
    STORAGE_BUCKET &&
    STORAGE_ACCOUNT_ID
  );
}

export function getStoragePublicUrl(key: string): string {
  if (STORAGE_PUBLIC_URL) {
    return `${STORAGE_PUBLIC_URL}/${key}`;
  }
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT}/${STORAGE_BUCKET}/${key}`;
  }
  return `https://${STORAGE_ACCOUNT_ID}.r2.cloudflarestorage.com/${STORAGE_BUCKET}/${key}`;
}

export interface StorageUploadOptions {
  buffer: Buffer;
  key: string;
  contentType: string;
  folder: string;
  bucketName?: string;
  contentDisposition?: string;
}

export interface StorageUploadResult {
  success: boolean;
  url: string;
  key: string;
  error?: string;
}

export async function uploadToStorage(
  options: StorageUploadOptions,
): Promise<StorageUploadResult> {
  const { buffer, key, contentType, folder, bucketName, contentDisposition } =
    options;
  const fullKey = `${folder}/${key}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName || STORAGE_BUCKET,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
      ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
      CacheControl: "public, max-age=31536000, immutable",
    });

    await storageClient.send(command);

    return {
      success: true,
      url: getStoragePublicUrl(fullKey),
      key: fullKey,
    };
  } catch (error) {
    console.error("[Storage] Upload error:", error);
    return {
      success: false,
      url: "",
      key: fullKey,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteFromStorage(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
    });

    await storageClient.send(command);
    return true;
  } catch (error) {
    console.error("[Storage] Delete error:", error);
    return false;
  }
}

export {
  storageClient,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_URL,
  STORAGE_ACCOUNT_ID,
};
