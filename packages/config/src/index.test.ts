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
    aiProvider: "deterministic"
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
