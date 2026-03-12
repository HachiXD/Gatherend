import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import type { WizardConfig, ServerConfig, Module } from "../types.js";
import { generateMainEnv } from "../generators/env.js";
import { generateMainCaddyfile } from "../generators/caddyfile.js";
import {
  generateLivekitConfig,
  generateLivekitCaddyConfig,
} from "../generators/livekit.js";

const DEPLOY_DIR = resolve(import.meta.dirname, "..", "..");

/**
 * Deploy the main (local) server.
 * Writes .env & Caddyfile, then runs docker compose up.
 */
export async function deployLocal(config: WizardConfig): Promise<void> {
  const mainServer = config.servers[0];

  // Write .env
  const envContent = generateMainEnv(config);
  writeFileSync(resolve(DEPLOY_DIR, ".env"), envContent, "utf-8");
  console.log(chalk.green("  ✔ .env written"));

  // Generate and write Caddyfile
  const caddyfile = generateMainCaddyfile(config, mainServer);
  const caddyDir = resolve(DEPLOY_DIR, "..", "apps", "gatherend-gateway");
  writeFileSync(resolve(caddyDir, "Caddyfile"), caddyfile, "utf-8");
  console.log(chalk.green("  ✔ Caddyfile written"));

  // LiveKit config (if on main server)
  if (mainServer.modules.includes("livekit")) {
    const livekitDir = resolve(DEPLOY_DIR, "livekit");
    mkdirSync(livekitDir, { recursive: true });

    // Get server's public IP for LiveKit
    let serverIp = "0.0.0.0";
    try {
      const cmd =
        process.platform === "win32"
          ? "curl.exe -4 -s ifconfig.me"
          : "curl -4 -s ifconfig.me";
      serverIp = execSync(cmd, {
        timeout: 5000,
      })
        .toString()
        .trim();
    } catch {
      console.log(
        chalk.yellow(
          "  ⚠ Could not detect public IP. Edit livekit/livekit.yaml manually.",
        ),
      );
    }

    const livekitYaml = generateLivekitConfig(config, serverIp);
    writeFileSync(resolve(livekitDir, "livekit.yaml"), livekitYaml, "utf-8");
    console.log(chalk.green("  ✔ livekit/livekit.yaml written"));
  }

  // Build profile flags
  const profiles = mainServer.modules.map((m) => `--profile ${m}`).join(" ");

  // Docker compose up
  const spinner = ora("Starting containers...").start();
  try {
    execSync(`docker compose ${profiles} up -d --build --remove-orphans`, {
      cwd: DEPLOY_DIR,
      stdio: "pipe",
      timeout: 600_000, // 10 minutes for builds
    });
    spinner.succeed("Containers started");
  } catch (err: any) {
    spinner.fail("Failed to start containers");
    console.log(chalk.red(err.stderr?.toString() || err.message));
    throw err;
  }
}
