export const PAYMENT_PROVIDERS = ["mock", "solana_devnet"] as const;
export const VOICE_PROVIDERS = ["replay", "agora"] as const;
export const AI_PROVIDERS = ["deterministic", "llm"] as const;
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export type RuntimeConfig = {
  nodeEnv: string;
  host: string;
  port: number;
  /** Exact browser origin allowed to call the production API. */
  webOrigin: string;
  demoMode: boolean;
  paymentProvider: PaymentProvider;
  solanaDevnet: {
    cluster: "devnet";
    rpcUrl: string;
    recipientPublicKey: string;
    demoAmountLamports: number;
    paymentLabel: string;
    commitment: "confirmed";
    ready: boolean;
  };
  voiceProvider: VoiceProvider;
  agora: {
    appId: string;
    appCertificate: string;
    customerId: string;
    customerSecret: string;
    /** Internal trusted-relay HMAC; never used for public Notifications. */
    providerEventSecret: string;
    /** Agora Notifications Center secret for Agora-Signature-V2. */
    ncsWebhookSecret: string;
    ncsProductId: string;
    agentProperties: Record<string, unknown>;
    tokenTtlSeconds: number;
    agentUid: number;
    agentName: string;
    baseUrl: string;
    ready: boolean;
  };
  aiProvider: AiProvider;
  /** Pino log level. Defaults to "info". Set LOG_LEVEL=debug for verbose output. */
  logLevel: LogLevel;
  /**
   * Maximum requests per minute per IP for rate-limited routes.
   * Set RATE_LIMIT_MAX=0 to disable rate limiting (development only).
   */
  rateLimitMax: number;
};

function readEnum<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const candidate = value ?? fallback;
  if (!allowed.includes(candidate as T)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return candidate as T;
}

function readBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535");
  }
  return port;
}

function readPositiveInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

function readStrictPositiveInt(name: string, value: string | undefined, fallback: number): number {
  const result = readPositiveInt(name, value, fallback);
  if (result === 0) throw new Error(`${name} must be greater than zero`);
  return result;
}

function readHttpUrl(name: string, value: string | undefined, fallback: string): string {
  let url: URL;
  try {
    url = new URL(value ?? fallback);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} must use http or https`);
  }
  return url.toString();
}

function readJsonObject(name: string, value: string | undefined): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${name} must be a JSON object`);
  }
}

export function readRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): RuntimeConfig {
  const recipientPublicKey = env.SOLANA_RECIPIENT_PUBLIC_KEY?.trim() ?? "";
  const solanaCluster = readEnum(
    "SOLANA_CLUSTER",
    env.SOLANA_CLUSTER,
    ["devnet"] as const,
    "devnet"
  );
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    host: env.API_HOST ?? "127.0.0.1",
    port: readPort(env.API_PORT),
    webOrigin: env.WEB_ORIGIN?.trim() ?? "",
    demoMode: readBoolean("DEMO_MODE", env.DEMO_MODE, true),
    paymentProvider: readEnum("PAYMENT_PROVIDER", env.PAYMENT_PROVIDER, PAYMENT_PROVIDERS, "mock"),
    solanaDevnet: {
      cluster: solanaCluster,
      rpcUrl: readHttpUrl("SOLANA_RPC_URL", env.SOLANA_RPC_URL, "https://api.devnet.solana.com"),
      recipientPublicKey,
      demoAmountLamports: readStrictPositiveInt(
        "SOLANA_DEMO_AMOUNT_LAMPORTS",
        env.SOLANA_DEMO_AMOUNT_LAMPORTS,
        1_000_000
      ),
      paymentLabel: env.SOLANA_PAYMENT_LABEL?.trim() || "Call-to-Cash Demo",
      commitment: "confirmed",
      ready: recipientPublicKey.length > 0
    },
    voiceProvider: readEnum("VOICE_PROVIDER", env.VOICE_PROVIDER, VOICE_PROVIDERS, "replay"),
    agora: {
      appId: env.AGORA_APP_ID?.trim() ?? "",
      appCertificate: env.AGORA_APP_CERTIFICATE?.trim() ?? "",
      customerId: env.AGORA_CUSTOMER_ID?.trim() ?? "",
      customerSecret: env.AGORA_CUSTOMER_SECRET?.trim() ?? "",
      providerEventSecret: env.AGORA_PROVIDER_EVENT_SECRET?.trim() ?? "",
      ncsWebhookSecret: env.AGORA_NCS_WEBHOOK_SECRET?.trim() ?? "",
      ncsProductId: env.AGORA_NCS_PRODUCT_ID?.trim() || "conversation-ai",
      agentProperties: readJsonObject("AGORA_CAI_PROPERTIES_JSON", env.AGORA_CAI_PROPERTIES_JSON),
      tokenTtlSeconds: readStrictPositiveInt(
        "AGORA_TOKEN_TTL_SECONDS",
        env.AGORA_TOKEN_TTL_SECONDS,
        600
      ),
      agentUid: readStrictPositiveInt("AGORA_AGENT_UID", env.AGORA_AGENT_UID, 9_001),
      agentName: env.AGORA_CAI_AGENT_NAME?.trim() || "call-to-cash-agent",
      baseUrl: readHttpUrl("AGORA_API_BASE_URL", env.AGORA_API_BASE_URL, "https://api.agora.io"),
      ready:
        (env.AGORA_APP_ID?.trim().length ?? 0) > 0 &&
        (env.AGORA_APP_CERTIFICATE?.trim().length ?? 0) > 0 &&
        (env.AGORA_CUSTOMER_ID?.trim().length ?? 0) > 0 &&
        (env.AGORA_CUSTOMER_SECRET?.trim().length ?? 0) > 0 &&
        (env.AGORA_PROVIDER_EVENT_SECRET?.trim().length ?? 0) > 0 &&
        Object.keys(readJsonObject("AGORA_CAI_PROPERTIES_JSON", env.AGORA_CAI_PROPERTIES_JSON))
          .length > 0
    },
    aiProvider: readEnum("AI_PROVIDER", env.AI_PROVIDER, AI_PROVIDERS, "deterministic"),
    logLevel: readEnum("LOG_LEVEL", env.LOG_LEVEL, LOG_LEVELS, "info"),
    rateLimitMax: readPositiveInt("RATE_LIMIT_MAX", env.RATE_LIMIT_MAX, 100)
  };
}
