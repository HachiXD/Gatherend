import { expressBaseUrl } from "@/src/lib/env";
import { getExpressAuthHeaders } from "@/src/services/express/express-fetch";
import type { UploadFileInput } from "../domain/upload-repository";
import { UploadError, type UploadedFile } from "../domain/uploaded-file";

type UploadResponse = {
  success: boolean;
  assetId?: string;
  url?: string;
  storage?: "s3";
  mimeType?: string;
  originalName?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  error?: string;
  moderation?: {
    allowed: boolean;
    reason?: string;
    cached: boolean;
    processingTimeMs: number;
  };
};

export type UploadsHttpDataSource = {
  uploadFile: (input: UploadFileInput) => Promise<UploadedFile>;
};

function resolveExpressUrl(path: string) {
  return `${expressBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function getFallbackName(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  return cleanUri.split("/").pop() || "upload";
}

function mapUploadResponse(
  data: UploadResponse,
  input: UploadFileInput,
): UploadedFile {
  if (!data.assetId || !data.url) {
    throw new UploadError("Upload response is missing asset data");
  }

  return {
    assetId: data.assetId,
    url: data.url,
    storage: data.storage ?? "s3",
    type: data.mimeType ?? input.file.type,
    name: data.originalName ?? input.file.name ?? getFallbackName(input.file.uri),
    size: data.sizeBytes ?? input.file.size ?? 0,
    width: data.width,
    height: data.height,
  };
}

async function readUploadError(response: Response, fallbackMessage: string) {
  const data = (await response.json().catch(() => null)) as UploadResponse | null;
  const message = data?.error || fallbackMessage;

  if (data?.moderation && !data.moderation.allowed) {
    throw new UploadError(message, {
      isModerationBlock: true,
      moderation: data.moderation,
    });
  }

  throw new UploadError(message);
}

export function createUploadsHttpDataSource(): UploadsHttpDataSource {
  return {
    async uploadFile(input) {
      const formData = new FormData();
      const file = {
        uri: input.file.uri,
        name: input.file.name || getFallbackName(input.file.uri),
        type: input.file.type,
      } as unknown as Blob;

      formData.append("image", file);
      formData.append("context", input.context);

      if (input.boardId) {
        formData.append("boardId", input.boardId);
      }

      const response = await fetch(resolveExpressUrl("/upload"), {
        method: "POST",
        credentials: "omit",
        headers: getExpressAuthHeaders(input.profileId),
        body: formData,
      });

      if (!response.ok) {
        await readUploadError(response, "Upload failed");
      }

      const data = (await response.json()) as UploadResponse;

      if (!data.success) {
        if (data.moderation && !data.moderation.allowed) {
          throw new UploadError(data.error || "Content not allowed", {
            isModerationBlock: true,
            moderation: data.moderation,
          });
        }

        throw new UploadError(data.error || "Upload failed");
      }

      return mapUploadResponse(data, input);
    },
  };
}

