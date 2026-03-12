import chalk from "chalk";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

export async function welcome(): Promise<"fresh" | "existing"> {
  console.log("");
  console.log(chalk.cyan.bold("┌─────────────────────────────────────┐"));
  console.log(chalk.cyan.bold("│     Gatherend Setup Wizard  v1.0    │"));
  console.log(chalk.cyan.bold("└─────────────────────────────────────┘"));
  console.log(chalk.dim("        ∧＿∧                         "));
  console.log(chalk.dim("       (｡･ω･｡)つ━☆・*。              "));
  console.log(chalk.dim("       ⊂/　  /　          ・゜        "));
  console.log(chalk.dim("        しーＪ　      °。+*°。        "));
  console.log(chalk.dim("                         .・゜        "));
  console.log(chalk.dim("                     ゜｡ﾟﾟ･｡･ﾟﾟ      "));
  console.log(chalk.dim("                          ╱|、        "));
  console.log(chalk.dim("                        (˚ˎ 。7       "));
  console.log(chalk.dim("                         |、˜〵       "));
  console.log(chalk.dim("                        じしˍ,)ノ     "));
  console.log("");

  // Check Docker
  try {
    execSync("docker --version", { stdio: "ignore" });
  } catch {
    console.log(chalk.red("  ✘ Docker not found"));
    console.log(
      chalk.yellow(
        "    Install Docker: https://docs.docker.com/engine/install/",
      ),
    );
    process.exit(1);
  }

  try {
    execSync("docker compose version", { stdio: "ignore" });
  } catch {
    try {
      execSync("docker-compose --version", { stdio: "ignore" });
      console.log(
        chalk.yellow(
          "  ⚠ Using legacy docker-compose. Consider upgrading to Compose v2.",
        ),
      );
    } catch {
      console.log(chalk.red("  ✘ Docker Compose not found"));
      console.log(
        chalk.yellow("    Install: https://docs.docker.com/compose/install/"),
      );
      process.exit(1);
    }
  }
  console.log(chalk.green("  ✔ Docker and Docker Compose detected"));

  // Check for existing installation
  // This file lives in `deploy/wizard/steps`, but the generated `.env` is written to `deploy/.env`.
  const envPath = resolve(import.meta.dirname, "..", "..", ".env");
  if (existsSync(envPath)) {
    console.log(
      chalk.yellow("  ⚠ Existing installation detected (.env found)"),
    );
    return "existing";
  }

  console.log(chalk.green("  ✔ Fresh installation"));
  console.log("");
  return "fresh";
}
