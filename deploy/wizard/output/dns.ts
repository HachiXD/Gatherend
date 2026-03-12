import { execSync } from "child_process";
import chalk from "chalk";
import type { WizardConfig, Module } from "../types.js";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  note: string;
}

/**
 * Show the DNS records the user needs to create.
 */
export function showDnsRecords(config: WizardConfig): void {
  if (config.isLocalOnly) {
    console.log(chalk.yellow("  Local mode — no DNS records needed."));
    return;
  }

  const d = config.domain;
  const records: DnsRecord[] = [];
  const mainServer = config.servers[0];

  // Main server IP: try to detect it
  let mainIp = "<THIS_SERVER_IP>";
  try {
    const cmd = process.platform === "win32" ? "curl.exe -s ifconfig.me" : "curl -s ifconfig.me";
    mainIp = execSync(cmd, { timeout: 5000 })
      .toString()
      .trim();
  } catch {}

  // Core: main domain → main server
  records.push({
    type: "A",
    name: d,
    value: mainIp,
    note: "Main app",
  });

  // For each module, figure out which server it's on and add DNS records
  for (const server of config.servers) {
    const ip = server.isLocal ? mainIp : server.ip!;

    if (server.modules.includes("images")) {
      records.push({
        type: "A",
        name: `img.${d}`,
        value: ip,
        note: "imgproxy (image processing)",
      });
      records.push({
        type: "A",
        name: `avatars.${d}`,
        value: ip,
        note: "Dicebear (avatar generation)",
      });
    }

    if (server.modules.includes("moderation")) {
      records.push({
        type: "A",
        name: `moderation.${d}`,
        value: ip,
        note: "NudeNet (content moderation)",
      });
    }

    if (server.modules.includes("minio")) {
      records.push({
        type: "A",
        name: `s3.${d}`,
        value: ip,
        note: "MinIO (S3 storage)",
      });
    }

    if (server.modules.includes("livekit")) {
      records.push({
        type: "A",
        name: `media.${d}`,
        value: ip,
        note: "LiveKit — DNS-only (grey cloud), never proxied",
      });
      records.push({
        type: "A",
        name: `turn.${d}`,
        value: ip,
        note: "TURN relay — DNS-only (grey cloud), never proxied",
      });
    }
  }

  const hasLivekit = config.servers.some((s) => s.modules.includes("livekit"));

  console.log("");
  console.log(chalk.cyan.bold("  DNS Records to Create"));
  console.log(chalk.cyan("  ─────────────────────"));
  console.log("");
  console.log(
    chalk.dim(
      "  Use DNS-only mode (grey cloud) in Cloudflare for Let's Encrypt,"
    )
  );
  console.log(
    chalk.dim(
      "  or Proxied (orange cloud) with Full (Strict) SSL + Origin Certificate."
    )
  );
  if (hasLivekit) {
    console.log("");
    console.log(
      chalk.yellow(
        "  ⚠ LiveKit (media.* and turn.*) must ALWAYS use DNS-only (grey cloud)."
      )
    );
    console.log(
      chalk.yellow(
        "    Cloudflare proxy does not support WebRTC/UDP — voice and video will break."
      )
    );
  }
  console.log("");

  // Table header
  const typeW = 6;
  const nameW = Math.max(30, ...records.map((r) => r.name.length + 2));
  const valueW = 18;

  console.log(
    chalk.bold(
      `  ${"Type".padEnd(typeW)} ${"Name".padEnd(nameW)} ${"Value".padEnd(valueW)} Note`
    )
  );
  console.log(
    `  ${"─".repeat(typeW)} ${"─".repeat(nameW)} ${"─".repeat(valueW)} ${"─".repeat(20)}`
  );

  for (const r of records) {
    console.log(
      `  ${chalk.green(r.type.padEnd(typeW))} ${r.name.padEnd(nameW)} ${chalk.yellow(r.value.padEnd(valueW))} ${chalk.dim(r.note)}`
    );
  }

  console.log("");
}
