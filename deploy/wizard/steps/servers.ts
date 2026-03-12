import { select, checkbox, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { ServerConfig, Module } from "../types.js";
import { ALL_MODULES } from "../types.js";

export async function askServers(
  isLocalOnly: boolean,
): Promise<ServerConfig[]> {
  if (isLocalOnly) {
    console.log("");
    console.log(
      chalk.yellow(
        "  Local-only mode selected (no domain). Remote servers are disabled.",
      ),
    );

    const modules = await askSingleServerModules();
    return [{ id: 1, isLocal: true, modules }];
  }

  const serverCount = await select({
    message: "Deployment setup:",
    choices: [
      { value: 1, name: "Single server - everything on this machine" },
      { value: 2, name: "Two servers - main + one other server" },
      { value: 3, name: "Three servers - main + two other servers" },
    ],
  });

  const servers: ServerConfig[] = [{ id: 1, isLocal: true, modules: [] }];

  if (serverCount === 1) {
    servers[0].modules = await askSingleServerModules();
    return servers;
  }

  const server1Modules = await checkbox({
    message: "Which modules on the MAIN server? (core app is always included)",
    choices: ALL_MODULES.map((m) => ({
      value: m.value,
      name: `${m.name} - ${m.description}`,
    })),
  });
  servers[0].modules = server1Modules;

  const remainingModules = ALL_MODULES.filter(
    (m) => !server1Modules.includes(m.value),
  );

  if (remainingModules.length === 0) {
    console.log(
      chalk.yellow(
        "  All modules are already assigned to the main server. Skipping additional servers.",
      ),
    );
    return servers;
  }

  const server2 = await askRemoteServer(2, remainingModules);
  servers.push(server2);

  if (serverCount === 3) {
    const remainingForServer3 = remainingModules.filter(
      (m) => !server2.modules.includes(m.value),
    );

    if (remainingForServer3.length > 0) {
      const server3 = await askRemoteServer(3, remainingForServer3);
      servers.push(server3);
    } else {
      console.log(
        chalk.yellow("  All modules are already assigned. Skipping server 3."),
      );
    }
  }

  return servers;
}

async function askRemoteServer(
  serverNumber: number,
  availableModules: typeof ALL_MODULES,
): Promise<ServerConfig> {
  console.log("");
  console.log(chalk.cyan.bold(`  == Server ${serverNumber} ==`));

  let modules: Module[] = [];
  if (availableModules.length > 0) {
    modules = await checkbox({
      message: `Which modules on Server ${serverNumber}?`,
      choices: availableModules.map((m) => ({
        value: m.value,
        name: `${m.name} - ${m.description}`,
        checked: true,
      })),
      validate: (selected) => {
        if (selected.length === 0)
          return "Select at least one module for this server";
        return true;
      },
    });
  }

  const ip = await input({
    message: `Server ${serverNumber} IP address:`,
    validate: (val) => {
      const v = val.trim();
      if (!v) return "IP is required";
      if (!isValidIPv4(v)) return "Enter a valid IPv4 address";
      return true;
    },
  });

  const deployMode = await select({
    message: `How should Server ${serverNumber} be deployed?`,
    choices: [
      {
        value: "auto" as const,
        name: "Automatic - connect via SSH and deploy for me",
      },
      {
        value: "manual" as const,
        name: "Manual - generate files locally, I'll deploy them myself",
      },
    ],
  });

  let sshUser: string | undefined;
  let sshPort: number | undefined;
  let sshKeyPath: string | undefined;

  if (deployMode === "auto") {
    sshUser = (
      await input({
        message: "SSH user (default: ubuntu):",
        default: "ubuntu",
      })
    ).trim();

    sshPort = parseInt(
      await input({
        message: "SSH port (default: 22):",
        default: "22",
        validate: (val) => {
          const n = parseInt(val, 10);
          if (Number.isNaN(n) || n < 1 || n > 65535)
            return "Enter a valid port number";
          return true;
        },
      }),
      10,
    );

    sshKeyPath = (
      await input({
        message: "Path to SSH private key:",
        default: "~/.ssh/id_rsa",
        validate: (val) => {
          if (!val.trim()) return "Key path is required";
          return true;
        },
      })
    ).trim();
  } else {
    const manualUser = (
      await input({
        message: "SSH user for instructions (default: ubuntu):",
        default: "ubuntu",
      })
    ).trim();
    sshUser = manualUser || undefined;

    sshPort = parseInt(
      await input({
        message: "SSH port for instructions (default: 22):",
        default: "22",
        validate: (val) => {
          const n = parseInt(val, 10);
          if (Number.isNaN(n) || n < 1 || n > 65535)
            return "Enter a valid port number";
          return true;
        },
      }),
      10,
    );
  }

  return {
    id: serverNumber,
    isLocal: false,
    ip: ip.trim(),
    deployMode,
    sshUser: sshUser?.trim() || undefined,
    sshPort,
    sshKeyPath: sshKeyPath?.trim() || undefined,
    modules,
  };
}

async function askSingleServerModules(): Promise<Module[]> {
  console.log("");

  type Preset = "full" | "no-minio" | "minimal" | "custom";

  const preset = await select<Preset>({
    message: "Choose an installation preset:",
    choices: [
      {
        value: "full",
        name: "Recommended — Core + Image Processing + LiveKit + MinIO storage",
        description:
          "Best for most self-hosted installs. Includes voice/video rooms, image optimization, avatars, and self-hosted object storage.",
      },
      {
        value: "no-minio",
        name: "Recommended — Core + Image Processing + LiveKit (bring your own storage)",
        description:
          "Same as above but uses an external S3-compatible bucket (R2, Backblaze, AWS S3, etc.) instead of MinIO.",
      },
      {
        value: "minimal",
        name: "Minimal — Core only",
        description:
          "Just the app and database. No voice/video, no image processing. Good for testing or low-resource machines. \u26a0  Image uploads, avatars, and voice rooms will likely produce errors — the app is not fully tested without these modules.",
      },
      {
        value: "custom",
        name: "Custom — choose modules manually",
        description: "Pick exactly which modules to enable.",
      },
    ],
  });

  if (preset === "full") return ["images", "livekit", "minio"];
  if (preset === "no-minio") return ["images", "livekit"];
  if (preset === "minimal") return [];

  // Custom: show the full checkbox
  return checkbox({
    message: "Which modules do you want? (space to select)",
    choices: ALL_MODULES.map((m) => ({
      value: m.value,
      name: `${m.name} - ${m.description}`,
      checked: m.value === "images",
    })),
  });
}

function isValidIPv4(raw: string): boolean {
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}
