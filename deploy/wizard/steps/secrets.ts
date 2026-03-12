import { randomBytes } from "crypto";
import chalk from "chalk";
import type { WizardConfig, Module } from "../types.js";

function generateSecret(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

function generateApiKey(prefix: string): string {
  return `${prefix}${randomBytes(12).toString("base64url")}`;
}

export function generateSecrets(
  config: Pick<WizardConfig, "servers">,
  existingSecrets?: Partial<WizardConfig>,
): Partial<WizardConfig> {
  const allModules = new Set<Module>();
  for (const server of config.servers) {
    for (const m of server.modules) {
      allModules.add(m);
    }
  }

  const secrets: Partial<WizardConfig> = {
    // Core secrets - preserve existing or generate new
    postgresPassword: existingSecrets?.postgresPassword || generateSecret(24),
    redisPassword: existingSecrets?.redisPassword || generateSecret(24),
    betterAuthSecret: existingSecrets?.betterAuthSecret || generateSecret(),
    internalApiSecret: existingSecrets?.internalApiSecret || generateSecret(),
    attachmentsHmacKey: existingSecrets?.attachmentsHmacKey || generateSecret(),
    cfOriginSecret: existingSecrets?.cfOriginSecret || generateSecret(16),
    cronSecret: existingSecrets?.cronSecret || generateSecret(16),
  };

  // imgproxy keys (shared between main and services server)
  if (allModules.has("images")) {
    secrets.imgproxyKey = existingSecrets?.imgproxyKey || generateSecret();
    secrets.imgproxySalt = existingSecrets?.imgproxySalt || generateSecret();
  }

  // NudeNet API key
  if (allModules.has("moderation")) {
    secrets.nudenetApiKey =
      existingSecrets?.nudenetApiKey || generateSecret(16);
  }

  // LiveKit
  if (allModules.has("livekit")) {
    secrets.livekitApiKey =
      existingSecrets?.livekitApiKey || generateApiKey("API");
    secrets.livekitApiSecret =
      existingSecrets?.livekitApiSecret || generateSecret();
  }

  // MinIO
  if (allModules.has("minio")) {
    secrets.minioRootUser = existingSecrets?.minioRootUser || "gatherend";
    secrets.minioRootPassword =
      existingSecrets?.minioRootPassword || generateSecret(24);
  }

  console.log(chalk.green("  OK: Secrets generated"));
  return secrets;
}
