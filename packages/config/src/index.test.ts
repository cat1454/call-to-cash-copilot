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
      ncsProductId: "conversation-ai",
      agentProperties: {},
      tokenTtlSeconds: 600,
      agentUid: 9001,
      agentName: "call-to-cash-agent",
      baseUrl: "https://api.agora.io/",
      ready: false
    },
    aiProvider: "deterministic",
    logLevel: "info",
    rateLimitMax: 100
  });
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
