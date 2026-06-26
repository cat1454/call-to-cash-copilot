import assert from "node:assert/strict";
import test from "node:test";

import { readRuntimeConfig } from "./index.js";

test("runtime config defaults to explicit deterministic demo providers", () => {
  assert.deepEqual(readRuntimeConfig({}), {
    nodeEnv: "development",
    host: "127.0.0.1",
    port: 3001,
    webOrigin: "",
    demoMode: true,
    paymentProvider: "mock",
    solanaDevnet: {
      cluster: "devnet",
      rpcUrl: "https://api.devnet.solana.com/",
      recipientPublicKey: "",
      demoAmountLamports: 1_000_000,
      paymentLabel: "Call-to-Cash Demo",
      commitment: "confirmed",
      ready: false
    },
    voiceProvider: "replay",
    agora: {
      appId: "",
      appCertificate: "",
      customerId: "",
      customerSecret: "",
      providerEventSecret: "",
      ncsWebhookSecret: "",
      agentProperties: {},
      tokenTtlSeconds: 600,
      agentUid: 9001,
      agentName: "call-to-cash-agent",
      baseUrl: "https://api.agora.io/",
      liveRelay: {
        url: "http://127.0.0.1:3011/",
        controlSecret: "",
        uid: 9002,
        ready: false
      },
      ready: false
    },
    aiProvider: "deterministic",
    aiExtraction: {
      mode: "hybrid",
      model: "gpt-5-mini",
      apiKey: "",
      timeoutMs: 1_500,
      promptVersion: "CTC-BOOKING-EXTRACTION-V1"
    },
    logLevel: "info",
    rateLimitMax: 100
  });
});

test("OpenAI extraction config is server-only and validates its bounded timeout", () => {
  const config = readRuntimeConfig({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "server-only-test-key",
    OPENAI_MODEL: "gpt-5-mini",
    AI_EXTRACTION_TIMEOUT_MS: "1500"
  });
  assert.equal(config.aiProvider, "openai");
  assert.equal(config.aiExtraction.apiKey, "server-only-test-key");
  assert.equal(config.aiExtraction.timeoutMs, 1_500);
});

test("OpenAI extraction requires a server-only key only when selected", () => {
  assert.throws(() => readRuntimeConfig({ AI_PROVIDER: "openai" }), /OPENAI_API_KEY is required/);
  assert.equal(readRuntimeConfig({}).aiExtraction.apiKey, "");
});

test("Agora configuration is opt-in and rejects malformed agent properties", () => {
  assert.equal(readRuntimeConfig({ VOICE_PROVIDER: "agora" }).agora.ready, false);
  assert.throws(
    () => readRuntimeConfig({ AGORA_CAI_PROPERTIES_JSON: "[]" }),
    /AGORA_CAI_PROPERTIES_JSON/
  );
});

test("runtime config rejects invalid provider modes", () => {
  assert.throws(
    () => readRuntimeConfig({ PAYMENT_PROVIDER: "solana-mainnet" }),
    /PAYMENT_PROVIDER/
  );
});

test("Solana Devnet is opt-in and missing recipient config fails readiness without failing startup", () => {
  const config = readRuntimeConfig({ PAYMENT_PROVIDER: "solana_devnet" });

  assert.equal(config.paymentProvider, "solana_devnet");
  assert.equal(config.solanaDevnet.ready, false);
  assert.equal(config.solanaDevnet.cluster, "devnet");
});

test("runtime config accepts the minimum complete Solana Devnet configuration", () => {
  const config = readRuntimeConfig({
    PAYMENT_PROVIDER: "solana_devnet",
    SOLANA_CLUSTER: "devnet",
    SOLANA_RPC_URL: "https://rpc.example.test",
    SOLANA_RECIPIENT_PUBLIC_KEY: "11111111111111111111111111111111",
    SOLANA_DEMO_AMOUNT_LAMPORTS: "2000000",
    SOLANA_PAYMENT_LABEL: "CTC Devnet"
  });

  assert.deepEqual(config.solanaDevnet, {
    cluster: "devnet",
    rpcUrl: "https://rpc.example.test/",
    recipientPublicKey: "11111111111111111111111111111111",
    demoAmountLamports: 2_000_000,
    paymentLabel: "CTC Devnet",
    commitment: "confirmed",
    ready: true
  });
});

test("runtime config parses an explicit false demo mode", () => {
  assert.equal(readRuntimeConfig({ DEMO_MODE: "false" }).demoMode, false);
});

test("Agora live readiness uses the native pipeline and needs no custom LLM gateway secret", () => {
  const baseEnv = {
    VOICE_PROVIDER: "agora",
    AGORA_APP_ID: "app",
    AGORA_APP_CERTIFICATE: "certificate",
    AGORA_CUSTOMER_ID: "customer",
    AGORA_CUSTOMER_SECRET: "secret",
    AGORA_PROVIDER_EVENT_SECRET: "provider-secret",
    AGORA_NCS_WEBHOOK_SECRET: "notifications-secret",
    AGORA_CAI_PROPERTIES_JSON: '{"pipeline_id":"pipeline"}',
    AGORA_RTM_RELAY_CONTROL_SECRET: "relay-control"
  };

  const config = readRuntimeConfig(baseEnv);
  assert.equal(config.agora.liveRelay.ready, true);
  assert.equal(config.agora.ready, true);
});

test("Agora config removes legacy custom LLM properties before the native pipeline joins", () => {
  const config = readRuntimeConfig({
    AGORA_CAI_PROPERTIES_JSON:
      '{"pipeline_id":"pipeline","llm":{"url":"https://legacy-gateway.invalid"}}'
  });

  assert.deepEqual(config.agora.agentProperties, { pipeline_id: "pipeline" });
});

test("runtime config preserves the exact production web origin", () => {
  assert.equal(
    readRuntimeConfig({ WEB_ORIGIN: "https://ctc.danangtoiiu.live" }).webOrigin,
    "https://ctc.danangtoiiu.live"
  );
});

test("runtime config reads LOG_LEVEL and RATE_LIMIT_MAX", () => {
  const config = readRuntimeConfig({ LOG_LEVEL: "debug", RATE_LIMIT_MAX: "200" });
  assert.equal(config.logLevel, "debug");
  assert.equal(config.rateLimitMax, 200);
});

test("runtime config rejects invalid LOG_LEVEL", () => {
  assert.throws(() => readRuntimeConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL/);
});

test("runtime config rejects negative RATE_LIMIT_MAX", () => {
  assert.throws(() => readRuntimeConfig({ RATE_LIMIT_MAX: "-1" }), /RATE_LIMIT_MAX/);
});

test("runtime config allows RATE_LIMIT_MAX=0 to disable limiting", () => {
  assert.equal(readRuntimeConfig({ RATE_LIMIT_MAX: "0" }).rateLimitMax, 0);
});
