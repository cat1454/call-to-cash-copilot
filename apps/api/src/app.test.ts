import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "./app.js";
import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  ErrorCodeSchema
} from "@call-to-cash/shared";

const demoConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3001,
  demoMode: true,
  paymentProvider: "mock",
  voiceProvider: "replay",
  aiProvider: "deterministic"
} as const;

test("GET /health returns the standard success envelope", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(ApiSuccessEnvelopeSchema.safeParse(payload).success, true);
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, "ok");
  assert.equal(payload.data.service, "api");
  assert.equal(typeof payload.meta.requestId, "string");

  await app.close();
});

test("GET /ready reports explicit demo providers", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "GET", url: "/ready" });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(ApiSuccessEnvelopeSchema.safeParse(payload).success, true);
  assert.deepEqual(payload.data, {
    status: "ready",
    mode: "demo",
    providers: {
      payment: "mock",
      voice: "replay",
      ai: "deterministic"
    }
  });

  await app.close();
});

test("unknown routes return the standard safe error envelope", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "GET", url: "/missing" });

  assert.equal(response.statusCode, 404);
  const payload = response.json();
  assert.equal(ApiErrorEnvelopeSchema.safeParse(payload).success, true);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, ErrorCodeSchema.enum.RESOURCE_NOT_FOUND);
  assert.equal(payload.error.retryable, false);
  assert.equal(typeof payload.error.requestId, "string");

  await app.close();
});
