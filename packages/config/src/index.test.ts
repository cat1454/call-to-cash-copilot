import assert from "node:assert/strict";
import test from "node:test";

import { readRuntimeConfig } from "./index.js";

test("runtime config defaults to explicit deterministic demo providers", () => {
  assert.deepEqual(readRuntimeConfig({}), {
    nodeEnv: "development",
    host: "127.0.0.1",
    port: 3001,
    demoMode: true,
    paymentProvider: "mock",
    voiceProvider: "replay",
    aiProvider: "deterministic",
    logLevel: "info",
    rateLimitMax: 100
  });
});

test("runtime config rejects invalid provider modes", () => {
  assert.throws(
    () => readRuntimeConfig({ PAYMENT_PROVIDER: "solana-mainnet" }),
    /PAYMENT_PROVIDER/
  );
});

test("runtime config parses an explicit false demo mode", () => {
  assert.equal(readRuntimeConfig({ DEMO_MODE: "false" }).demoMode, false);
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

