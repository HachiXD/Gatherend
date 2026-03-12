import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";

export interface DomainResult {
  domain: string;
  isLocalOnly: boolean;
}

export async function askDomain(): Promise<DomainResult> {
  const hasDomain = await confirm({
    message: "Do you have a domain ready?",
    default: true,
  });

  if (!hasDomain) {
    console.log("");
    console.log(
      chalk.yellow(
        "  ⚠ Running without a domain. HTTPS will be disabled and URLs will use http://localhost.",
      ),
    );
    console.log(
      chalk.dim(
        "  You can still expose the app externally via a tunnel (ngrok, cloudflared, etc.),",
      ),
    );
    console.log(
      chalk.dim(
        "  LAN IP, or SSH port forwarding — but that's outside the wizard's scope.",
      ),
    );
    console.log("");
    return { domain: "localhost", isLocalOnly: true };
  }

  const domain = await input({
    message: "Your domain (e.g. gatherend.com):",
    validate: (val) => {
      const d = val.trim().toLowerCase();
      if (!d) return "Domain is required";
      if (d.startsWith("http://") || d.startsWith("https://"))
        return "Enter the domain only (e.g. gatherend.com), without http:// or https://";
      if (d.includes("/"))
        return "Enter only the domain (e.g. gatherend.com), without paths";
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d))
        return "Enter a bare domain without protocols or paths (e.g. gatherend.com)";
      return true;
    },
    transformer: (val) => val.trim().toLowerCase(),
  });

  return { domain: domain.trim().toLowerCase(), isLocalOnly: false };
}
