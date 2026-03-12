import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { welcome } from "./steps/welcome.js";
import { askDomain } from "./steps/domain.js";
import { askServers } from "./steps/servers.js";
import { askModuleConfig } from "./steps/modules.js";
import { generateSecrets } from "./steps/secrets.js";
import { deployLocal } from "./deployers/local.js";
import { deployRemote, prepareManualDeploy } from "./deployers/remote.js";
import { showDnsRecords } from "./output/dns.js";
import { showSummary } from "./output/summary.js";
import type { WizardConfig } from "./types.js";

async function main() {
  try {
    // Step 1: Welcome & prerequisites
    const installMode = await welcome();

    // If existing install, try to read secrets from .env
    let existingSecrets: Partial<WizardConfig> | undefined;
    if (installMode === "existing") {
      existingSecrets = parseExistingEnv();
    }

    // Step 2: Domain
    const { domain, isLocalOnly } = await askDomain();

    // Step 3: Server setup & module assignment
    const servers = await askServers(isLocalOnly);

    // Step 4: Module-specific configuration (SMTP, OAuth, storage)
    const moduleConfig = await askModuleConfig({
      domain,
      isLocalOnly,
      servers,
    });

    // Step 5: Generate secrets
    const secrets = generateSecrets({ servers }, existingSecrets);

    // Assemble full config
    const config: WizardConfig = {
      domain,
      isLocalOnly,
      servers,
      // Required secrets (generated)
      postgresPassword: secrets.postgresPassword!,
      redisPassword: secrets.redisPassword!,
      betterAuthSecret: secrets.betterAuthSecret!,
      internalApiSecret: secrets.internalApiSecret!,
      attachmentsHmacKey: secrets.attachmentsHmacKey!,
      cfOriginSecret: secrets.cfOriginSecret!,
      cronSecret: secrets.cronSecret!,
      // Optional secrets
      ...secrets,
      // User-provided config
      ...moduleConfig,
    };

    // Step 6: Deploy
    console.log("");
    console.log(chalk.cyan.bold("  ── Deploying :D ──"));

    // Deploy main (local) server
    await deployLocal(config);

    // Deploy remote servers
    for (const server of servers) {
      if (!server.isLocal && server.modules.length > 0) {
        console.log("");
        console.log(
          chalk.cyan.bold(
            `  ── Deploying Server ${server.id} (${server.ip}) ──`,
          ),
        );

        if (server.deployMode === "manual") {
          prepareManualDeploy(config, server);
        } else {
          await deployRemote(config, server);
        }
      }
    }

    // Step 7: Show DNS records
    showDnsRecords(config);

    // Step 8: Summary
    showSummary(config);
  } catch (err: any) {
    // Handle Ctrl+C
    if (err?.message?.includes("User force closed")) {
      console.log("");
      console.log(chalk.yellow("  Cancelled :(."));
      process.exit(0);
    }

    console.error("");
    console.error(chalk.red("  Error: ") + err.message);
    process.exit(1);
  }
}

/**
 * Parse an existing .env file to preserve secrets when reconfiguring.
 */
function parseExistingEnv(): Partial<WizardConfig> {
  const envPath = resolve(import.meta.dirname, "..", ".env");
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    vars[key] = value;
  }

  return {
    postgresPassword: vars.POSTGRES_PASSWORD,
    redisPassword: vars.REDIS_PASSWORD,
    betterAuthSecret: vars.BETTER_AUTH_SECRET,
    internalApiSecret: vars.INTERNAL_API_SECRET,
    attachmentsHmacKey: vars.ATTACHMENTS_HMAC_KEY,
    cfOriginSecret: vars.CF_ORIGIN_SECRET,
    cronSecret: vars.CRON_SECRET,
    imgproxyKey: vars.IMGPROXY_KEY,
    imgproxySalt: vars.IMGPROXY_SALT,
    nudenetApiKey: vars.NUDENET_API_KEY,
    livekitApiKey: vars.LIVEKIT_API_KEY,
    livekitApiSecret: vars.LIVEKIT_API_SECRET,
    minioRootUser: vars.MINIO_ROOT_USER,
    minioRootPassword: vars.MINIO_ROOT_PASSWORD,
  };
}

main();
