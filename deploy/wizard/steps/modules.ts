import { input, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import type { WizardConfig, Module } from "../types.js";

export async function askModuleConfig(
  config: Pick<WizardConfig, "domain" | "isLocalOnly" | "servers">
): Promise<Partial<WizardConfig>> {
  const result: Partial<WizardConfig> = {};
  const allModules = new Set<Module>();

  for (const server of config.servers) {
    for (const m of server.modules) {
      allModules.add(m);
    }
  }

  // Storage - always ask, since core needs it
  console.log("");
  console.log(chalk.cyan.bold("  == Storage Configuration =="));

  if (allModules.has("minio")) {
    console.log(chalk.green("  MinIO selected - storage will be self-hosted."));
    // MinIO credentials are auto-generated in secrets step
  } else {
    const hasStorage = await confirm({
      message:
        "Do you have an S3-compatible storage configured? (R2, S3, Backblaze, etc.)",
      default: false,
    });

    if (hasStorage) {
      const isR2 = await confirm({
        message: "Is your storage provider Cloudflare R2?",
        default: true,
      });

      if (isR2) {
        result.storageAccountId = await requiredInput(
          "Cloudflare Account ID (R2):"
        );
        result.s3Endpoint = undefined;
      } else {
        result.storageAccountId = undefined;
        result.s3Endpoint = await requiredUrl(
          "S3 endpoint URL (e.g. https://s3.yourdomain.com or https://s3.us-east-1.amazonaws.com):"
        );
      }

      result.storageAccessKeyId = await requiredInput("Storage Access Key ID:");
      result.storageSecretAccessKey = await requiredPassword(
        "Storage Secret Access Key:"
      );
      result.storageBucketName = await requiredInput("Storage bucket name:");
      result.storagePublicUrl = await requiredUrl(
        "Storage public URL (CDN URL for the bucket):"
      );

      console.log("");
      const wantsPrivateAttachments = await confirm({
        message:
          "Do you want a separate private bucket for attachments (messages/DMs) with HMAC-signed URLs?",
        default: false,
      });

      if (wantsPrivateAttachments) {
        console.log("");
        console.log(
          chalk.yellow(
            "  WARNING: This requires a reverse proxy in front of the private bucket"
          )
        );
        console.log(
          chalk.yellow(
            "           that validates the HMAC signature before serving the file."
          )
        );
        console.log(
          chalk.dim(
            "           Example: a Cloudflare Worker for R2, or Caddy/nginx for other providers."
          )
        );
        console.log(chalk.dim("           See the documentation for guidance."));
        console.log("");

        result.attachmentsBucketName = await requiredInput(
          "Attachments bucket name (private):"
        );
        result.attachmentsBaseUrl = await requiredUrl(
          "Attachments proxy URL (reverse proxy URL, NOT the bucket itself):"
        );
      } else {
        console.log(
          chalk.dim(
            "  Using the public bucket for attachments (no access control)."
          )
        );
        // NOTE: The current app code requires ATTACHMENTS_BUCKET_NAME for message/DM uploads.
        // Setting these keeps uploads working even without a private bucket/proxy.
        result.attachmentsBucketName = result.storageBucketName;
        result.attachmentsBaseUrl = result.storagePublicUrl;
      }
    } else {
      console.log(
        chalk.yellow(
          "  Skipping storage. File uploads will not work until configured."
        )
      );
    }
  }

  // SMTP
  console.log("");
  console.log(chalk.cyan.bold("  == Email (SMTP) =="));
  const hasSmtp = await confirm({
    message: "Do you have SMTP configured? (needed for email verification)",
    default: false,
  });

  if (hasSmtp) {
    result.smtpHost = await requiredInput("SMTP host:");
    const smtpPortRaw = await optionalInput("SMTP port (default: 587):");
    const smtpPort = smtpPortRaw ? Number.parseInt(smtpPortRaw, 10) : Number.NaN;
    result.smtpPort =
      Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 587;

    result.smtpUser = await optionalInput("SMTP user:");
    result.smtpPass = await requiredPassword("SMTP password:");
    result.smtpFrom = await requiredInput("SMTP from address:");
    result.smtpFromName = await optionalInput("SMTP from name (optional):");
  } else {
    console.log(chalk.yellow("  Skipping SMTP. Email features will be disabled."));
  }

  // OAuth
  console.log("");
  console.log(chalk.cyan.bold("  == OAuth Providers (optional) =="));
  const hasOAuth = await confirm({
    message: "Do you want to configure OAuth login? (Discord, Google)",
    default: false,
  });

  if (hasOAuth) {
    console.log(chalk.dim("  Leave empty to skip a provider."));

    result.discordClientId = await optionalInput("Discord Client ID:");
    if (result.discordClientId) {
      result.discordClientSecret = await optionalPassword(
        "Discord Client Secret:"
      );
    }

    result.googleClientId = await optionalInput("Google Client ID:");
    if (result.googleClientId) {
      result.googleClientSecret = await optionalPassword("Google Client Secret:");
    }
  }

  return result;
}

function isValidUrl(raw: string): boolean {
  try {
    new URL(raw);
    return true;
  } catch {
    return false;
  }
}

async function optionalInput(message: string): Promise<string | undefined> {
  const val = await input({ message, default: "" });
  return val.trim() || undefined;
}

async function requiredInput(message: string): Promise<string> {
  while (true) {
    const val = (await input({ message, default: "" })).trim();
    if (val) return val;
    console.log(chalk.red("  This value is required."));
  }
}

async function requiredUrl(message: string): Promise<string> {
  while (true) {
    const val = (await input({ message, default: "" })).trim();
    if (!val) {
      console.log(chalk.red("  This value is required."));
      continue;
    }
    if (isValidUrl(val)) return val;
    console.log(chalk.red("  Please enter a valid URL (including http/https)."));
  }
}

async function optionalPassword(message: string): Promise<string | undefined> {
  const val = await password({ message, mask: "*" });
  return val.trim() || undefined;
}

async function requiredPassword(message: string): Promise<string> {
  while (true) {
    const val = (await password({ message, mask: "*" })).trim();
    if (val) return val;
    console.log(chalk.red("  This value is required."));
  }
}
