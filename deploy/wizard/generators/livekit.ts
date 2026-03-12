import { readFileSync } from "fs";
import { resolve } from "path";
import type { WizardConfig } from "../types.js";

const LIVEKIT_DIR = resolve(import.meta.dirname, "..", "..", "livekit");

/**
 * Generate livekit.yaml from the template,
 * filling in server IP, TURN domain, and API keys.
 */
export function generateLivekitConfig(
  config: WizardConfig,
  serverIp: string
): string {
  const template = readFileSync(
    resolve(LIVEKIT_DIR, "livekit.example.yaml"),
    "utf-8"
  );

  return template
    .replace(/\$\{LIVEKIT_SERVER_IP\}/g, serverIp)
    .replace(/\$\{LIVEKIT_TURN_DOMAIN\}/g, `turn.${config.domain}`)
    .replace(/\$\{LIVEKIT_API_KEY\}/g, config.livekitApiKey || "")
    .replace(/\$\{LIVEKIT_API_SECRET\}/g, config.livekitApiSecret || "");
}

/**
 * Generate Caddy JSON config (caddy.yaml) for standalone LiveKit servers.
 * This handles TLS via Let's Encrypt and L4 SNI routing.
 */
export function generateLivekitCaddyConfig(config: WizardConfig): string {
  const template = readFileSync(
    resolve(LIVEKIT_DIR, "caddy.example.yaml"),
    "utf-8"
  );

  return template
    .replace(/\$\{LIVEKIT_DOMAIN\}/g, `media.${config.domain}`)
    .replace(/\$\{LIVEKIT_TURN_DOMAIN\}/g, `turn.${config.domain}`);
}
