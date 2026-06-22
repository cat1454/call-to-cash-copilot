import assert from "node:assert/strict";
import test from "node:test";

import {
  browserSecretNames,
  evaluateProviderConfig,
  isSolanaPublicKey,
  parseEnv,
  selectWebEnv
} from "./demo-preflight.mjs";

test("preflight parser does not require printing values", () => {
  assert.deepEqual(parseEnv("VOICE_PROVIDER=agora\n# hidden\nTOKEN='secret'"), {
    VOICE_PROVIDER: "agora",
    TOKEN: "secret"
  });
});

test("preflight rejects server secret names in browser configuration", () => {
  assert.deepEqual(browserSecretNames({ VITE_AGORA_APP_CERTIFICATE: "hidden" }), [
    "VITE_AGORA_APP_CERTIFICATE"
  ]);
  assert.deepEqual(browserSecretNames({ VITE_AGORA_PROMPT: "hidden" }), ["VITE_AGORA_PROMPT"]);
  assert.deepEqual(browserSecretNames({ VITE_API_BASE_URL: "http://127.0.0.1:3001" }), []);
});

test("provider config fails closed on voice mismatch and incomplete Agora", () => {
  const results = evaluateProviderConfig(
    { VOICE_PROVIDER: "agora", PAYMENT_PROVIDER: "mock" },
    { VITE_VOICE_PROVIDER: "replay" }
  );
  assert.equal(
    results.some((item) => item.label === "Voice provider alignment" && item.level === "FAIL"),
    true
  );
  assert.equal(
    results.some((item) => item.label === "Agora App Certificate" && item.level === "FAIL"),
    true
  );
});

test("provider alignment accepts explicit live and replay pairs", () => {
  const live = evaluateProviderConfig(
    {
      VOICE_PROVIDER: "agora",
      PAYMENT_PROVIDER: "mock",
      AGORA_APP_ID: "present",
      AGORA_APP_CERTIFICATE: "present",
      AGORA_CUSTOMER_ID: "present",
      AGORA_CUSTOMER_SECRET: "present",
      AGORA_PROVIDER_EVENT_SECRET: "present",
      AGORA_RTM_RELAY_CONTROL_SECRET: "present",
      AGORA_NCS_WEBHOOK_SECRET: "present",
      AGORA_CAI_PROPERTIES_JSON: "{}"
    },
    { VITE_VOICE_PROVIDER: "agora" }
  );
  const replay = evaluateProviderConfig(
    { VOICE_PROVIDER: "replay", PAYMENT_PROVIDER: "mock" },
    { VITE_VOICE_PROVIDER: "replay" }
  );
  assert.equal(live.find((item) => item.label === "Voice provider alignment")?.level, "PASS");
  assert.equal(replay.find((item) => item.label === "Voice provider alignment")?.level, "PASS");
});

test("preflight gives Vite's local browser environment precedence", () => {
  const selected = selectWebEnv(
    { VITE_VOICE_PROVIDER: "agora", VITE_API_BASE_URL: "http://127.0.0.1:3001" },
    { VITE_VOICE_PROVIDER: "replay" },
    { VITE_VOICE_PROVIDER: "replay" }
  );

  assert.equal(selected.VITE_VOICE_PROVIDER, "agora");
});

test("Solana public-key validation accepts exactly 32 decoded bytes", () => {
  assert.equal(isSolanaPublicKey("11111111111111111111111111111111"), true);
  assert.equal(isSolanaPublicKey("not-a-key"), false);
});
