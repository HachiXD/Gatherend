import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";
import chalk from "chalk";
import ora from "ora";
import { NodeSSH } from "node-ssh";
import type { WizardConfig, ServerConfig } from "../types.js";
import { generateServicesEnv } from "../generators/env.js";
import { generateServicesCaddyfile } from "../generators/caddyfile.js";
import {
  generateLivekitConfig,
  generateLivekitCaddyConfig,
} from "../generators/livekit.js";

const DEPLOY_DIR = resolve(import.meta.dirname, "..", "..");
const SERVICES_DIR = resolve(DEPLOY_DIR, "services");
const GENERATED_DIR = resolve(DEPLOY_DIR, "generated");

/**
 * Write generated config files to a local directory for a remote server.
 * Used by both auto and manual deploy modes.
 */
function writeServerFiles(
  config: WizardConfig,
  server: ServerConfig
): string {
  const outputDir = resolve(GENERATED_DIR, `server-${server.id}`);
  mkdirSync(outputDir, { recursive: true });

  // .env
  const envContent = generateServicesEnv(config, server);
  writeFileSync(join(outputDir, ".env"), envContent, "utf-8");

  // Caddyfile
  const caddyfile = generateServicesCaddyfile(config, server);
  writeFileSync(join(outputDir, "Caddyfile"), caddyfile, "utf-8");

  // LiveKit config
  if (server.modules.includes("livekit")) {
    const livekitYaml = generateLivekitConfig(config, server.ip!);
    writeFileSync(join(outputDir, "livekit.yaml"), livekitYaml, "utf-8");
  }

  return outputDir;
}

/**
 * Manual deploy: generate files locally and show copy/run instructions.
 */
export function prepareManualDeploy(
  config: WizardConfig,
  server: ServerConfig
): void {
  const outputDir = writeServerFiles(config, server);

  const profiles = server.modules
    .map((m) => `--profile ${m}`)
    .join(" ");

  const sshUser = server.sshUser || "ubuntu";
  const sshPort = server.sshPort || 22;
  const scpPortFlag = sshPort !== 22 ? `-P ${sshPort} ` : "";
  const sshPortFlag = sshPort !== 22 ? `-p ${sshPort} ` : "";

  console.log("");
  console.log(chalk.green(`  ✔ Files generated in: ${outputDir}`));
  console.log("");
  console.log(chalk.cyan("  Copy these files to the remote server and run:"));
  console.log("");
  console.log(chalk.dim(`  # 1. Copy files to the remote server`));
  console.log(
    `  scp ${scpPortFlag}-r ${outputDir}/* ${sshUser}@${server.ip}:~/services/`
  );

  // Also need docker-compose.yml and Dockerfile.caddy from services/
  console.log("");
  console.log(chalk.dim(`  # 2. Copy docker-compose and build files`));
  const composePath = resolve(SERVICES_DIR, "docker-compose.yml");
  const caddyDockerfile = resolve(SERVICES_DIR, "Dockerfile.caddy");
  console.log(
    `  scp ${scpPortFlag}${composePath} ${sshUser}@${server.ip}:~/services/docker-compose.yml`
  );
  console.log(
    `  scp ${scpPortFlag}${caddyDockerfile} ${sshUser}@${server.ip}:~/services/Dockerfile.caddy`
  );

  if (server.modules.includes("moderation")) {
    const moderationDir = resolve(SERVICES_DIR, "nsfwjs-service");
    console.log(
      `  scp ${scpPortFlag}-r ${moderationDir} ${sshUser}@${server.ip}:~/services/nsfwjs-service`
    );
  }

  console.log("");
  console.log(chalk.dim(`  # 3. Start the containers`));
  console.log(
    `  ssh ${sshPortFlag}${sshUser}@${server.ip} "cd ~/services && docker compose ${profiles} up -d --build --remove-orphans"`
  );
  console.log("");
}

/**
 * Automatic deploy: connect via SSH, upload files with putFile, start containers.
 */
export async function deployRemote(
  config: WizardConfig,
  server: ServerConfig
): Promise<void> {
  // Generate files locally first
  const outputDir = writeServerFiles(config, server);

  const ssh = new NodeSSH();

  const spinner = ora(
    `Connecting to ${server.sshUser || "ubuntu"}@${server.ip}...`
  ).start();

  try {
    let keyPath = server.sshKeyPath || "~/.ssh/id_rsa";
    if (keyPath.startsWith("~")) {
      keyPath = keyPath.replace(
        "~",
        process.env.HOME || process.env.USERPROFILE || ""
      );
    }

    await ssh.connect({
      host: server.ip!,
      port: server.sshPort || 22,
      username: server.sshUser || "ubuntu",
      privateKeyPath: keyPath,
    });
    spinner.succeed(`Connected to ${server.ip}`);
  } catch (err: any) {
    spinner.fail(`Failed to connect to ${server.ip}`);
    console.log(chalk.red(`  ${err.message}`));
    throw err;
  }

  // Resolve home directory (SFTP doesn't expand ~)
  const { stdout: homeDir } = await ssh.execCommand("echo $HOME");
  const remoteDir = `${homeDir.trim()}/services`;

  try {
    // 1. Create remote directory structure
    await ssh.execCommand(`mkdir -p ${remoteDir}/nsfwjs-service`);

    // 2. Upload docker-compose.yml
    const composePath = resolve(SERVICES_DIR, "docker-compose.yml");
    if (existsSync(composePath)) {
      await ssh.putFile(composePath, `${remoteDir}/docker-compose.yml`);
      console.log(chalk.green("  ✔ docker-compose.yml uploaded"));
    }

    // 3. Upload Dockerfile.caddy
    const caddyDockerfile = resolve(SERVICES_DIR, "Dockerfile.caddy");
    if (existsSync(caddyDockerfile)) {
      await ssh.putFile(caddyDockerfile, `${remoteDir}/Dockerfile.caddy`);
      console.log(chalk.green("  ✔ Dockerfile.caddy uploaded"));
    }

    // 4. Upload nsfwjs-service files (if moderation module)
    if (server.modules.includes("moderation")) {
      const moderationDir = resolve(SERVICES_DIR, "nsfwjs-service");
      const moderationFiles = ["Dockerfile", "package.json", "server.js"];
      for (const f of moderationFiles) {
        const localPath = resolve(moderationDir, f);
        if (existsSync(localPath)) {
          await ssh.putFile(localPath, `${remoteDir}/nsfwjs-service/${f}`);
        }
      }
      console.log(chalk.green("  ✔ nsfwjs-service files uploaded"));
    }

    // 5. Upload generated files via putFile (not heredoc)
    await ssh.putFile(join(outputDir, ".env"), `${remoteDir}/.env`);
    console.log(chalk.green("  ✔ .env uploaded"));

    await ssh.putFile(join(outputDir, "Caddyfile"), `${remoteDir}/Caddyfile`);
    console.log(chalk.green("  ✔ Caddyfile uploaded"));

    if (server.modules.includes("livekit")) {
      await ssh.putFile(
        join(outputDir, "livekit.yaml"),
        `${remoteDir}/livekit.yaml`
      );
      console.log(chalk.green("  ✔ livekit.yaml uploaded"));
    }

    // 6. Build profile flags and start containers
    const profiles = server.modules.map((m) => `--profile ${m}`).join(" ");

    const startSpinner = ora("Starting containers on remote...").start();
    const result = await Promise.race([
      ssh.execCommand(
        `cd ${remoteDir} && docker compose ${profiles} up -d --build --remove-orphans`
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Deploy timed out after 10 minutes")),
          600_000
        )
      ),
    ]);

    if (result.code !== 0) {
      startSpinner.fail("Failed to start containers on remote");
      console.log(chalk.red(result.stderr));
      throw new Error(result.stderr);
    }

    startSpinner.succeed(`Containers started on ${server.ip}`);
  } finally {
    ssh.dispose();
  }
}
