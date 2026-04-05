export type Module = "images" | "moderation" | "minio" | "livekit";

export interface ServerConfig {
  id: number;
  isLocal: boolean;
  ip?: string;
  deployMode?: "auto" | "manual";
  sshUser?: string;
  sshPort?: number;
  sshKeyPath?: string;
  modules: Module[];
}

export interface WizardConfig {
  domain: string;
  isLocalOnly: boolean;
  servers: ServerConfig[];

  // Auto-generated secrets
  postgresPassword: string;
  redisPassword: string;
  betterAuthSecret: string;
  internalApiSecret: string;
  attachmentsHmacKey: string;
  cfOriginSecret: string;
  cronSecret: string;

  // Module-generated secrets
  livekitApiKey?: string;
  livekitApiSecret?: string;
  livekitServerIp?: string;
  contentModerationApiKey?: string;
  imgproxyKey?: string;
  imgproxySalt?: string;
  minioRootUser?: string;
  minioRootPassword?: string;

  // User-provided: Storage
  s3Endpoint?: string;
  storageAccountId?: string;
  storageAccessKeyId?: string;
  storageSecretAccessKey?: string;
  storageBucketName?: string;
  storagePublicUrl?: string;
  attachmentsBucketName?: string;
  attachmentsBaseUrl?: string;

  // User-provided: SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpFromName?: string;

  // User-provided: OAuth
  discordClientId?: string;
  discordClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export const ALL_MODULES: {
  value: Module;
  name: string;
  description: string;
}[] = [
  {
    value: "images",
    name: "Image Processing",
    description: "imgproxy + dicebear (avatars, image optimization)",
  },
  {
    value: "moderation",
    name: "Content Moderation",
    description:
      "NSFWJS service (detects explicit sexual content including hentai)",
  },
  {
    value: "minio",
    name: "MinIO Storage",
    description: "Self-hosted S3-compatible storage (replaces R2/S3)",
  },
  {
    value: "livekit",
    name: "LiveKit Voice/Video",
    description: "Voice channels and video rooms",
  },
];
