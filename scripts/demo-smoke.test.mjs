import assert from "node:assert/strict";
import test from "node:test";

import {
  getSpawnOptions,
  getProcessTreeTermination,
  getColdStartServicePorts,
  hasScenario4BookingSummary,
  isColdStartRequested,
  isDevnetDrawerIntent
} from "./demo-smoke.mjs";

test("Scenario 4 smoke accepts only the server payload required by the Devnet drawer", () => {
  assert.equal(
    isDevnetDrawerIntent({
      provider: "solana_devnet",
      expiresAt: "2026-06-25T00:00:00.000Z",
      providerPayment: { solanaPayUrl: "solana:11111111111111111111111111111111?amount=0.001" }
    }),
    true
  );
  assert.equal(isDevnetDrawerIntent({ provider: "mock", providerPayment: {} }), false);
});

test("Scenario 4 smoke requires a complete, masked booking summary before payment", () => {
  const booking = {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi",
    departureAt: "2026-06-28T12:00:00.000Z",
    passengerCount: 4,
    pickupPoint: "Ben xe Trung tam Da Nang",
    contactPhoneMasked: "0901***567",
    fareTotalVnd: 1_800_000,
    depositAmountVnd: 300_000
  };
  assert.equal(hasScenario4BookingSummary(booking), true);
  assert.equal(hasScenario4BookingSummary({ ...booking, passengerCount: 3 }), false);
  assert.equal(hasScenario4BookingSummary({ ...booking, contactPhoneMasked: "0901234567" }), false);
});

test("cold-start smoke is opt-in and explicit", () => {
  assert.equal(isColdStartRequested(["node", "scripts/demo-smoke.mjs", "--cold-start"]), true);
  assert.equal(isColdStartRequested(["node", "scripts/demo-smoke.mjs"]), false);
});

test("cold-start smoke reserves the exact API, relay, and web ports it will own", () => {
  assert.deepEqual(
    getColdStartServicePorts(
      {
        VITE_API_BASE_URL: "http://127.0.0.1:4101",
        AGORA_RTM_RELAY_URL: "http://127.0.0.1:4111",
        VOICE_PROVIDER: "agora",
        DEMO_WEB_URL: "http://localhost:4173"
      },
      { VITE_API_BASE_URL: "http://127.0.0.1:4101" }
    ),
    [
      { label: "API", port: 4101 },
      { label: "Agora RTM relay", port: 4111 },
      { label: "Web demo", port: 4173 }
    ]
  );
});

test("Windows launches command shims through a shell while keeping native executables direct", () => {
  assert.equal(getSpawnOptions("corepack.cmd", "win32").shell, true);
  assert.equal(getSpawnOptions("docker", "win32").shell, false);
});

test("Windows cleanup terminates the spawned command tree instead of only its .cmd wrapper", () => {
  assert.deepEqual(getProcessTreeTermination(1234, "win32"), {
    executable: "taskkill",
    args: ["/PID", "1234", "/T", "/F"]
  });
  assert.equal(getProcessTreeTermination(1234, "linux"), null);
});
