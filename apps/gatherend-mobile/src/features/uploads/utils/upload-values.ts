import type { UploadedFile } from "../domain/uploaded-file";

export type StoredUploadValue = {
  assetId: string;
  url: string;
  type?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
};

type UploadAssetLike = {
  id: string;
  url: string | null;
  width?: number | null;
  height?: number | null;
};

export function parseStoredUploadValue(
  value: string | null | undefined,
): StoredUploadValue | null {
  if (!value || value.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredUploadValue>;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.assetId !== "string" ||
      typeof parsed.url !== "string"
    ) {
      return null;
    }

    return {
      assetId: parsed.assetId,
      url: parsed.url,
      type: typeof parsed.type === "string" ? parsed.type : undefined,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      size: typeof parsed.size === "number" ? parsed.size : undefined,
      width: typeof parsed.width === "number" ? parsed.width : undefined,
      height: typeof parsed.height === "number" ? parsed.height : undefined,
    };
  } catch {
    return null;
  }
}

export function getStoredUploadAssetId(
  value: string | null | undefined,
): string | null {
  return parseStoredUploadValue(value)?.assetId ?? null;
}

export function getStoredUploadValueFromAsset(
  asset: UploadAssetLike | null | undefined,
): string {
  if (!asset?.id || !asset.url) {
    return "";
  }

  return JSON.stringify({
    assetId: asset.id,
    url: asset.url,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  });
}

export function getStoredUploadValueFromUploadedFile(file: UploadedFile): string {
  return JSON.stringify({
    assetId: file.assetId,
    url: file.url,
    type: file.type,
    name: file.name,
    size: file.size,
    width: file.width,
    height: file.height,
  });
}

