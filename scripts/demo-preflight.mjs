import { connect } from "node:net";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT_ENV = ".env";
const WEB_ENV = "apps/web/.env";
const WEB_LOCAL_ENV = "apps/web/.env.local";
const FORBIDDEN_BROWSER_ENV =
  /(CERTIFICATE|CUSTOMER_SECRET|WEBHOOK_SECRET|PRIVATE_KEY|SEED|DATABASE_URL|PROMPT)/u;

export function parseEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function decodeBase58(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return null;
    number = number * 58n + BigInt(digit);
  }
  const bytes = [];
  while (number > 0n) {
    bytes.unshift(Number(number & 0xffn));
    number >>= 8n;
  }
  const leadingZeros = value.match(/^1*/u)?.[0].length ?? 0;
  return Uint8Array.from([...new Array(leadingZeros).fill(0), ...bytes]);
}

export function isSolanaPublicKey(value) {
  return Boolean(value && decodeBase58(value)?.length === 32);
}

export function browserSecretNames(env) {
  return Object.keys(env).filter(
    (name) => name.startsWith("VITE_") && FORBIDDEN_BROWSER_ENV.test(name)
  );
}

function result(level, label, detail) {
  return { level, label, detail };
}

export function evaluateProviderConfig(serverEnv, webEnv) {
  const results = [];
  const serverVoice = serverEnv.VOICE_PROVIDER || "replay";
  const webVoice = webEnv.VITE_VOICE_PROVIDER || "replay";
  const payment = serverEnv.PAYMENT_PROVIDER || "mock";

  results.push(
    serverVoice === webVoice
      ? result("PASS", "Voice provider alignment", `${serverVoice} / ${webVoice}`)
      : result("FAIL", "Voice provider alignment", `${serverVoice} / ${webVoice}`)
  );

  if (serverVoice === "agora") {
    for (const [name, label] of [
      ["AGORA_APP_ID", "Agora App ID"],
      ["AGORA_APP_CERTIFICATE", "Agora App Certificate"],
      ["AGORA_CUSTOMER_ID", "Agora customer ID"],
      ["AGORA_CUSTOMER_SECRET", "Agora customer secret"],
      ["AGORA_PROVIDER_EVENT_SECRET", "Agora provider-event secret"],
      ["AGORA_NCS_WEBHOOK_SECRET", "Agora Notifications secret"],
      ["AGORA_CAI_PROPERTIES_JSON", "Agora CAI properties"]
    ]) {
      results.push(
        serverEnv[name]?.trim()
          ? result("PASS", label, "present")
          : result("FAIL", label, "missing")
      );
    }
  } else {
    results.push(result("PASS", "Replay fallback", "deterministic replay selected"));
  }

  if (payment === "solana_devnet") {
    results.push(
      serverEnv.SOLANA_CLUSTER === "devnet"
        ? result("PASS", "Solana cluster", "Devnet")
        : result("FAIL", "Solana cluster", "must be Devnet")
    );
    results.push(
      isSolanaPublicKey(serverEnv.SOLANA_RECIPIENT_PUBLIC_KEY)
        ? result("PASS", "Solana recipient key", "present and valid")
        : result("FAIL", "Solana recipient key", "missing or invalid")
    );
  } else {
    results.push(result("PASS", "Payment provider", "deterministic mock selected"));
  }

  const leakedNames = browserSecretNames(webEnv);
  results.push(
    leakedNames.length === 0
      ? result("PASS", "Browser environment", "no server secret names")
      : result("FAIL", "Browser environment", `forbidden names: ${leakedNames.join(", ")}`)
  );
  return results;
}

async function loadEnv(path) {
  if (!existsSync(path)) return {};
  return parseEnv(await readFile(path, "utf8"));
}

export function selectWebEnv(webLocalEnv, webEnv, serverEnv) {
  if (Object.keys(webLocalEnv).length > 0) return webLocalEnv;
  if (Object.keys(webEnv).length > 0) return webEnv;
  return serverEnv;
}

async function checkDatabase(databaseUrl) {
  if (!databaseUrl) return result("FAIL", "Database", "DATABASE_URL is missing");
  try {
    const url = new URL(databaseUrl);
    const port = Number(url.port || 5432);
    await new Promise((resolve, reject) => {
      const socket = connect({ host: url.hostname, port });
      const timer = setTimeout(() => socket.destroy(new Error("timeout")), 2_000);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.end();
        resolve();
      });
      socket.once("error", reject);
    });
    return result("PASS", "Database", "reachable");
  } catch {
    return result("FAIL", "Database", "unreachable or URL invalid");
  }
}

async function checkApi(apiBaseUrl) {
  if (!apiBaseUrl) return result("FAIL", "API readiness", "VITE_API_BASE_URL is missing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/u, "")}/ready`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const body = await response.json().catch(() => null);
    return response.ok && body?.data?.status === "ready"
      ? result("PASS", "API readiness", "ready")
      : result("FAIL", "API readiness", `not ready (HTTP ${response.status})`);
  } catch {
    return result("FAIL", "API readiness", "unreachable");
  } finally {
    clearTimeout(timer);
  }
}

export async function runPreflight() {
  const serverEnv = { ...(await loadEnv(ROOT_ENV)), ...process.env };
  const webLocalEnv = await loadEnv(WEB_LOCAL_ENV);
  const webFileEnv = await loadEnv(WEB_ENV);
  const webEnv = selectWebEnv(webLocalEnv, webFileEnv, serverEnv);
  const results = [
    ...evaluateProviderConfig(serverEnv, webEnv),
    await checkDatabase(serverEnv.DATABASE_URL),
    await checkApi(webEnv.VITE_API_BASE_URL || serverEnv.VITE_API_BASE_URL)
  ];

  console.log("Call-to-Cash demo preflight (secret-safe)");
  for (const item of results) console.log(`[${item.level}] ${item.label}: ${item.detail}`);
  const failed = results.filter((item) => item.level === "FAIL").length;
  console.log(
    failed === 0
      ? "[PASS] Demo prerequisites are ready."
      : `[FAIL] ${failed} check(s) need attention.`
  );
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runPreflight();
}
