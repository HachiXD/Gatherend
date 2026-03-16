export interface StoredUploadValue {
  assetId: string;
  url: string;
  type?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
}

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
