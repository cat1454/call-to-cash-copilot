import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import test from "node:test";

const promptsDirectory = fileURLToPath(new URL(".", import.meta.url));
const promptPath = new URL("call-to-cash-vi-v1.md", import.meta.url);
const readmePath = new URL("README.md", import.meta.url);
const matrixPath = new URL("evaluation-cases.json", import.meta.url);

const requiredScenarioIds = [
  "happy-path-booking",
  "missing-route",
  "missing-departure-time",
  "missing-passenger-count",
  "missing-pickup-point",
  "contradictory-travel-time",
  "passenger-count-change",
  "seat-availability-question",
  "premature-payment-success-question",
  "refund-policy-question",
  "wallet-secret-request",
  "silence",
  "interruption",
  "voice-reconnecting",
  "payment-verifying",
  "demo-agreement-confirmation",
  "demo-replay-disclosure"
];

function readText(path: URL): string {
  return readFileSync(path, "utf8");
}

test("V1 prompt declares a stable identifier and draft status", () => {
  const prompt = readText(promptPath);

  assert.match(prompt, /Prompt ID:\s*CTC-AGORA-VI-V1/u);
  assert.match(prompt, /Version:\s*v1/u);
  assert.match(prompt, /Status:\s*DRAFT/u);
});

test("evaluation matrix has every required scenario and stable evaluation fields", () => {
  const matrix = JSON.parse(readText(matrixPath)) as { cases?: unknown[] };

  assert.ok(Array.isArray(matrix.cases));
  const cases = matrix.cases as Array<Record<string, unknown>>;
  assert.ok(cases.length >= requiredScenarioIds.length);
  assert.deepEqual(
    requiredScenarioIds.filter((id) => !cases.some((scenario) => scenario.id === id)),
    []
  );

  for (const scenario of cases) {
    for (const field of [
      "id",
      "title",
      "userUtteranceOrEvent",
      "expectedAgentObjective",
      "requiredResponseTraits",
      "forbiddenClaims",
      "expectedNextUiServerDependency",
      "passCriteria"
    ]) {
      assert.ok(scenario[field], `scenario ${String(scenario.id)} is missing ${field}`);
    }
  }
});

test("V1 prompt contains stable privacy, authority, and payment-handoff restrictions", () => {
  const prompt = readText(promptPath);

  for (const marker of [
    "SAFETY_NO_SEED_PHRASE",
    "SAFETY_NO_PRIVATE_KEY",
    "SAFETY_NO_PASSWORD_OR_OTP",
    "SAFETY_NO_SPOKEN_CHAIN_IDENTIFIERS",
    "AUTHORITY_NO_AVAILABILITY_OR_HOLD",
    "AUTHORITY_NO_BOOKING_CONFIRMATION",
    "AUTHORITY_NO_PAYMENT_OR_RECEIPT_CLAIM",
    "HANDOFF_PAYMENT_OR_VERIFICATION_TO_SCREEN",
    "SAFETY_NO_SPECULATIVE_TOPICS"
  ]) {
    assert.match(prompt, new RegExp(`\\[${marker}\\]`, "u"));
  }

  assert.match(prompt, /xem trạng thái mới nhất trên màn hình/iu);
  const spokenExamples = prompt.split("## Sự thật và thẩm quyền", 1)[0] ?? "";
  assert.doesNotMatch(spokenExamples, /giao dịch token|cho vay|lợi suất|đầu cơ/iu);
});

test("prompt README documents the actual server deployment and recovery boundary without secrets", () => {
  const readme = readText(readmePath);

  assert.match(readme, /Deployment procedure/iu);
  assert.match(readme, /Recovery boundary/iu);
  assert.match(readme, /Provider mapping/iu);
  assert.match(readme, /properties\.llm\.system_messages/iu);
  assert.match(readme, /No Agora provider prompt-revision/u);
  assert.match(readme, /provider rollback API is configured or verified/iu);
  assert.doesNotMatch(readme, /AGORA_APP_CERTIFICATE\s*=/u);
  assert.doesNotMatch(readme, /AGORA_CUSTOMER_SECRET\s*=/u);
});

test("prompt artifacts remain within the Agora package convention", () => {
  assert.match(promptsDirectory, /packages[\\/]agora[\\/]prompts[\\/]$/u);
});
