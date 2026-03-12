import chalk from "chalk";
import type { WizardConfig } from "../types.js";
import { ALL_MODULES } from "../types.js";

/**
 * Show a summary of the deployment.
 */
export function showSummary(config: WizardConfig): void {
  const d = config.domain;
  const scheme = config.isLocalOnly ? "http" : "https";
  const url = `${scheme}://${d}`;

  console.log("");
  console.log(chalk.cyan.bold("  Deployment Summary"));
  console.log(chalk.cyan("  ──────────────────"));
  console.log("");

  // Servers
  for (const server of config.servers) {
    const label = server.isLocal
      ? "Main server (this machine)"
      : `Server ${server.id} (${server.ip})`;
    const mods = server.isLocal
      ? ["core", ...server.modules]
      : server.modules;

    console.log(
      `  ${chalk.bold(label)}: ${mods.map((m) => chalk.green(m)).join(", ")}`
    );
  }

  console.log("");

  // URLs
  console.log(chalk.bold("  URLs:"));
  console.log(`    App:        ${chalk.underline(url)}`);

  const allModules = new Set(
    config.servers.flatMap((s) => s.modules)
  );

  if (allModules.has("images")) {
    console.log(
      `    imgproxy:   ${chalk.underline(`${scheme}://img.${d}`)}`
    );
    console.log(
      `    Avatars:    ${chalk.underline(`${scheme}://avatars.${d}`)}`
    );
  }

  if (allModules.has("moderation")) {
    console.log(
      `    Moderation: ${chalk.underline(`${scheme}://moderation.${d}`)}`
    );
  }

  if (allModules.has("minio")) {
    console.log(
      `    MinIO:      ${chalk.underline(`${scheme}://s3.${d}`)}`
    );
  }

  if (allModules.has("livekit")) {
    console.log(
      `    LiveKit:    ${chalk.underline(`wss://media.${d}`)}`
    );
  }

  console.log("");
  console.log(chalk.green.bold("  ✔ Deployment complete!"));

  // Warn about attachment signing when using external storage
  const usesMinio = config.servers.some((s) => s.modules.includes("minio"));
  const hasExternalStorage = !usesMinio && !!config.storageAccessKeyId;

  if (hasExternalStorage) {
    console.log("");
    console.log(chalk.yellow.bold("  ⚠  Attachment access — review required"));
    console.log(
      chalk.yellow(
        "  Express signs attachment URLs with HMAC, but the signature is only"
      )
    );
    console.log(
      chalk.yellow(
        "  enforced if a reverse proxy sits in front of your bucket and validates it."
      )
    );
    console.log("");
    console.log(chalk.dim("  Two options depending on your setup:"));
    console.log("");
    console.log(chalk.dim("  Option A — Public bucket (simple, no access control):"));
    console.log(chalk.dim("    Set ATTACHMENTS_BASE_URL to your bucket's public URL."));
    console.log(chalk.dim("    The ?exp=&sig= params will be ignored by the bucket."));
    console.log(chalk.dim("    Attachments work immediately, but anyone with a key can access them."));
    console.log("");
    console.log(chalk.dim("  Option B — Private bucket + reverse proxy (recommended):"));
    console.log(chalk.dim("    Put a proxy in front of the bucket that validates the HMAC signature"));
    console.log(chalk.dim("    before allowing access. Set ATTACHMENTS_BASE_URL to the proxy URL."));
    console.log(chalk.dim("    · Cloudflare R2 → deploy a Worker that verifies the signature"));
    console.log(chalk.dim("    · Other providers → Caddy/nginx with a custom signature check snippet"));
    console.log(chalk.dim("    See the documentation for implementation guidance."));
  }
  console.log("");
  console.log(
    chalk.dim(
      "  To update images later: docker compose pull && docker compose up -d"
    )
  );
  console.log(
    chalk.dim(
      "  To reconfigure: npm start  (from deploy/wizard/)"
    )
  );
  console.log("");
}
