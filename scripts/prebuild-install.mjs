import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const pnpmModulesManifest = join(root, "node_modules", ".modules.yaml");

if (existsSync(pnpmModulesManifest)) {
  console.log("prebuild: pnpm workspace dependencies already installed");
  process.exit(0);
}

const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
const result = spawnSync(
  command,
  ["pnpm", "install", "--frozen-lockfile", "--config.confirmModulesPurge=false"],
  {
    cwd: root,
    stdio: "inherit"
  }
);

process.exit(result.status ?? 1);
