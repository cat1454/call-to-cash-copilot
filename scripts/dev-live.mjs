import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { evaluateProviderConfig, parseEnv, runPreflight, selectWebEnv } from "./demo-preflight.mjs";

const START_TIMEOUT_MS = 90_000;

function command(name, platform = process.platform) {
  return platform === "win32" ? `${name}.cmd` : name;
}

export function getLiveServiceCommands(platform = process.platform) {
  const corepack = command("corepack", platform);
  return [
    { label: "API", executable: corepack, args: ["pnpm", "dev:api"] },
    {
      label: "Web demo",
      executable: corepack,
      args: ["pnpm", "--filter", "@call-to-cash/web", "exec", "vite", "--strictPort"]
    },
    { label: "Agora RTM relay", executable: corepack, args: ["pnpm", "dev:rtm-relay"] }
  ];
}

export function getLiveServiceUrls(serverEnv, webEnv) {
  const apiBaseUrl = webEnv.VITE_API_BASE_URL;
  const relayUrl = serverEnv.AGORA_RTM_RELAY_URL || "http://127.0.0.1:3011";
  return {
    apiReady: `${apiBaseUrl.replace(/\/$/u, "")}/ready`,
    relayHealth: `${relayUrl.replace(/\/$/u, "")}/health`,
    web: serverEnv.DEMO_WEB_URL || "http://localhost:5173"
  };
}

export function getProcessTreeTermination(pid, platform = process.platform) {
  if (platform !== "win32") return null;
  return { executable: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
}

function getSpawnOptions(executable, stdio = "inherit") {
  return {
    cwd: process.cwd(),
    stdio,
    windowsHide: true,
    shell: process.platform === "win32" && executable.toLowerCase().endsWith(".cmd")
  };
}

function prefixStream(stream, label, target) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) target.write(`[${label}] ${line}\n`);
  });
  stream.on("end", () => {
    if (pending) target.write(`[${label}] ${pending}\n`);
  });
}

function startService(service) {
  const child = spawn(
    service.executable,
    service.args,
    getSpawnOptions(service.executable, ["inherit", "pipe", "pipe"])
  );
  prefixStream(child.stdout, service.label, process.stdout);
  prefixStream(child.stderr, service.label, process.stderr);
  return child;
}

function runCommand(executable, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, getSpawnOptions(executable));
    child.once("error", reject);
    child.once("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function waitForHttp(url, timeoutMs = START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `${url} did not become available within ${Math.round(timeoutMs / 1_000)} seconds.`
  );
}

async function stopProcessTree(child) {
  if (child.exitCode !== null || child.killed) return;
  const termination = getProcessTreeTermination(child.pid);
  if (!termination) {
    child.kill("SIGTERM");
    return;
  }
  await runCommand(
    termination.executable,
    termination.args,
    `Cleanup process tree ${child.pid}`
  ).catch(() => {
    child.kill();
  });
}

async function loadEnv(path) {
  try {
    return parseEnv(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

function requireLiveConfiguration(serverEnv, webEnv) {
  const results = evaluateProviderConfig(serverEnv, webEnv);
  const failed = results.filter((item) => item.level === "FAIL");
  if (serverEnv.VOICE_PROVIDER !== "agora") {
    failed.push({ label: "Voice provider", detail: "dev:live requires VOICE_PROVIDER=agora" });
  }
  if (webEnv.VITE_VOICE_PROVIDER !== "agora") {
    failed.push({
      label: "Browser voice provider",
      detail: "dev:live requires VITE_VOICE_PROVIDER=agora"
    });
  }
  if (!webEnv.VITE_API_BASE_URL) {
    failed.push({
      label: "Browser API URL",
      detail: "apps/web/.env or .env.local must set VITE_API_BASE_URL"
    });
  }
  if (failed.length > 0) {
    for (const item of failed) console.error(`[FAIL] ${item.label}: ${item.detail}`);
    throw new Error(
      "Live configuration is incomplete. Fix the reported environment values before startup."
    );
  }
}

function waitForShutdown(children) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      error ? reject(error) : resolve();
    };
    const onSignal = () => finish();
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    for (const child of children) {
      child.once("error", (error) => finish(error));
      child.once("exit", (code) => {
        if (!settled)
          finish(new Error(`${child.spawnargs.join(" ")} exited with code ${code ?? "unknown"}.`));
      });
    }
  });
}

export async function runLiveDev() {
  const serverEnv = { ...(await loadEnv(".env")), ...process.env };
  const webEnv = selectWebEnv(await loadEnv("apps/web/.env.local"), await loadEnv("apps/web/.env"));
  requireLiveConfiguration(serverEnv, webEnv);

  await runCommand("docker", ["compose", "up", "-d", "postgres"], "PostgreSQL startup");
  const corepack = command("corepack");
  await runCommand(corepack, ["pnpm", "db:migrate:deploy"], "Database migration");
  await runCommand(corepack, ["pnpm", "db:seed"], "Database seed");

  const children = getLiveServiceCommands().map(startService);
  try {
    const urls = getLiveServiceUrls(serverEnv, webEnv);
    await waitForHttp(urls.apiReady);
    await waitForHttp(urls.relayHealth);
    await waitForHttp(urls.web);
    if ((await runPreflight()) !== 0) throw new Error("Live preflight did not pass.");
    console.log(`[PASS] Live stack is ready: ${urls.web}`);
    await waitForShutdown(children);
  } finally {
    await Promise.all(children.map(stopProcessTree));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runLiveDev();
  } catch (error) {
    console.error(
      `[FAIL] Live startup: ${error instanceof Error ? error.message : "unknown error"}`
    );
    process.exitCode = 1;
  }
}
