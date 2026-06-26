import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { parseEnv, runPreflight, selectWebEnv } from "./demo-preflight.mjs";
import { scenarios } from "../apps/web/src/data/scenarios.js";

const COLD_START_TIMEOUT_MS = 90_000;

export function isColdStartRequested(args = process.argv) {
  return args.includes("--cold-start");
}

function portFromUrl(value, fallback) {
  if (!value) return fallback;
  const url = new URL(value);
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

export function getColdStartServicePorts(serverEnv, webEnv) {
  const apiBaseUrl = webEnv.VITE_API_BASE_URL || serverEnv.VITE_API_BASE_URL;
  const apiPort = Number(serverEnv.API_PORT) || portFromUrl(apiBaseUrl, 3001);
  const services = [{ label: "API", port: apiPort }];
  if (serverEnv.VOICE_PROVIDER === "agora") {
    services.push({
      label: "Agora RTM relay",
      port: portFromUrl(serverEnv.AGORA_RTM_RELAY_URL, 3011)
    });
  }
  services.push({
    label: "Web demo",
    port: portFromUrl(serverEnv.DEMO_WEB_URL, 5173)
  });
  return services;
}

function command(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

export function getSpawnOptions(executable, platform = process.platform) {
  return {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
    shell: platform === "win32" && executable.toLowerCase().endsWith(".cmd")
  };
}

export function getProcessTreeTermination(pid, platform = process.platform) {
  if (platform !== "win32") return null;
  return { executable: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
}

function runCommand(executable, args, label, timeoutMs = COLD_START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, getSpawnOptions(executable));
    const timer = setTimeout(() => {
      interruptProcess(child);
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1_000)} seconds.`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function startProcess(executable, args) {
  return spawn(executable, args, getSpawnOptions(executable));
}

function interruptProcess(child) {
  if (child.exitCode === null && !child.killed) child.kill();
}

async function stopProcessTree(child) {
  if (child.exitCode !== null || child.killed) return;
  const termination = getProcessTreeTermination(child.pid);
  if (!termination) {
    interruptProcess(child);
    return;
  }
  await runCommand(termination.executable, termination.args, `Cleanup process tree ${child.pid}`, 10_000);
}

function waitForPort(port, timeoutMs = COLD_START_TIMEOUT_MS) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Port ${port} did not become available.`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.end();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

async function requireColdStartPorts(services) {
  for (const service of services) {
    if (!(await isPortAvailable(service.port))) {
      throw new Error(
        `${service.label} port ${service.port} is already in use. Stop the existing demo service before running a cold-start smoke.`
      );
    }
  }
}

async function waitForHttp(url, timeoutMs = COLD_START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become available.`);
}

async function loadEnv(path) {
  try {
    return parseEnv(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

async function request(apiBaseUrl, path, init = {}) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/u, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error?.message ?? `HTTP ${response.status} for ${path}`);
  }
  return payload.data;
}

export function isDevnetDrawerIntent(paymentIntent) {
  return (
    paymentIntent?.provider === "solana_devnet" &&
    typeof paymentIntent?.providerPayment?.solanaPayUrl === "string" &&
    paymentIntent.providerPayment.solanaPayUrl.startsWith("solana:") &&
    typeof paymentIntent.expiresAt === "string"
  );
}

export function hasScenario4BookingSummary(booking) {
  const departureAt = new Date(booking?.departureAt);
  if (Number.isNaN(departureAt.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(departureAt);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return (
    booking?.routeFrom === "Da Nang" &&
    booking?.routeTo === "Ha Noi" &&
    value("month") === "06" &&
    value("day") === "28" &&
    value("hour") === "19" &&
    value("minute") === "00" &&
    booking?.passengerCount === 4 &&
    booking?.pickupPoint === "Ben xe Trung tam Da Nang" &&
    booking?.contactPhoneMasked === "0901***567" &&
    Number.isInteger(booking?.fareTotalVnd) &&
    Number.isInteger(booking?.depositAmountVnd)
  );
}

export async function runScenario4Smoke(apiBaseUrl) {
  const call = await request(apiBaseUrl, "/v1/calls", {
    method: "POST",
    body: JSON.stringify({ channelPurpose: "BOOKING", sourceMode: "TRANSCRIPT_REPLAY" })
  });
  let lastTurnId = null;
  for (const [index, turn] of scenarios.at(-1).entries()) {
    const result = await request(apiBaseUrl, `/v1/calls/${call.callId}/transcript-turns`, {
      method: "POST",
      body: JSON.stringify({
        turn: {
          clientTurnId: `cold-start-scenario-4-${call.callId}-${index}`,
          sequenceNo: index + 1,
          speaker: turn.sender === "customer" ? "CUSTOMER" : "AGENT",
          content: turn.text,
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      })
    });
    lastTurnId = result.turnId;
  }
  const callState = await request(apiBaseUrl, `/v1/calls/${call.callId}`);
  const booking = await request(apiBaseUrl, `/v1/bookings/${callState.booking.bookingId}`);
  if (
    booking.status !== "AGREEMENT_READY" ||
    !booking.agreementVersion ||
    !lastTurnId ||
    !hasScenario4BookingSummary(booking)
  ) {
    throw new Error("Scenario 4 did not produce the complete authoritative booking summary.");
  }
  await request(apiBaseUrl, `/v1/bookings/${booking.bookingId}/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": `cold-start-confirm-${call.callId}` },
    body: JSON.stringify({
      agreementVersion: booking.agreementVersion,
      confirmation: { method: "VOICE", confirmedTurnId: lastTurnId }
    })
  });
  const paymentIntent = await request(apiBaseUrl, "/v1/payments/create", {
    method: "POST",
    headers: { "Idempotency-Key": `cold-start-payment-${call.callId}` },
    body: JSON.stringify({ bookingId: booking.bookingId })
  });
  if (!isDevnetDrawerIntent(paymentIntent)) {
    throw new Error("Scenario 4 did not return the Solana Devnet payment drawer payload.");
  }
  return { callId: call.callId, bookingId: booking.bookingId, paymentIntentId: paymentIntent.paymentIntentId };
}

export async function runDemoSmoke() {
  if ((await runPreflight()) !== 0) return 1;
  const serverEnv = { ...(await loadEnv(".env")), ...process.env };
  const webEnv = selectWebEnv(
    await loadEnv("apps/web/.env.local"),
    await loadEnv("apps/web/.env"),
    serverEnv
  );
  const apiBaseUrl = webEnv.VITE_API_BASE_URL || serverEnv.VITE_API_BASE_URL;
  try {
    const result = await runScenario4Smoke(apiBaseUrl);
    console.log(`[PASS] Scenario 4 reached Devnet payment drawer payload: ${result.paymentIntentId}`);
    return 0;
  } catch (error) {
    console.error(`[FAIL] Scenario 4 smoke: ${error instanceof Error ? error.message : "unknown error"}`);
    return 1;
  }
}

export async function runColdStartSmoke() {
  const serverEnv = { ...(await loadEnv(".env")), ...process.env };
  const webEnv = selectWebEnv(
    await loadEnv("apps/web/.env.local"),
    await loadEnv("apps/web/.env"),
    serverEnv
  );
  const children = [];
  try {
    await requireColdStartPorts(getColdStartServicePorts(serverEnv, webEnv));
    await runCommand(
      "docker",
      ["compose", "up", "-d", "postgres"],
      "PostgreSQL startup (ensure Docker Desktop is running)"
    );
    const databasePort = Number(new URL(serverEnv.DATABASE_URL).port || 5432);
    await waitForPort(databasePort);
    await runCommand(command("corepack"), ["pnpm", "db:migrate:deploy"], "Database migration");
    await runCommand(command("corepack"), ["pnpm", "db:seed"], "Database seed");
    children.push(startProcess(command("corepack"), ["pnpm", "dev:api"]));
    children.push(startProcess(command("corepack"), ["pnpm", "dev:web", "--", "--strictPort"]));
    if (serverEnv.VOICE_PROVIDER === "agora") {
      children.push(startProcess(command("corepack"), ["pnpm", "dev:rtm-relay"]));
      await waitForHttp(`${serverEnv.AGORA_RTM_RELAY_URL || "http://127.0.0.1:3011"}/health`);
    }
    await waitForHttp(`${webEnv.VITE_API_BASE_URL}/ready`);
    await waitForHttp(serverEnv.DEMO_WEB_URL || "http://localhost:5173");
    return await runDemoSmoke();
  } catch (error) {
    console.error(`[FAIL] Cold-start smoke: ${error instanceof Error ? error.message : "unknown error"}`);
    return 1;
  } finally {
    await Promise.all(children.map(stopProcessTree));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await (isColdStartRequested() ? runColdStartSmoke() : runDemoSmoke());
}
