export type UploadedFile = {
  assetId: string;
  url: string;
  storage: "s3";
  type: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
};

export type UploadModeration = {
  allowed: boolean;
  reason?: string;
  cached: boolean;
  processingTimeMs: number;
};

export class UploadError extends Error {
  isModerationBlock: boolean;
  moderation?: UploadModeration;

  constructor(
    message: string,
    options: {
      isModerationBlock?: boolean;
      moderation?: UploadModeration;
    } = {},
  ) {
    super(message);
    this.name = "UploadError";
    this.isModerationBlock = options.isModerationBlock ?? false;
    this.moderation = options.moderation;
  }
}

