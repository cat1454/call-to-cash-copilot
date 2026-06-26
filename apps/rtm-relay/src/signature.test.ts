import assert from "node:assert/strict";
import test from "node:test";

import { signJsonPayload, verifyJsonPayload } from "./signature.js";

test("verifies an exact JSON HMAC and rejects a changed payload", () => {
  const payload = { callId: "call_123456", agentUid: 9001 };
  const signature = signJsonPayload("relay-control-secret", payload);

  assert.equal(verifyJsonPayload("relay-control-secret", payload, signature), true);
  assert.equal(
    verifyJsonPayload("relay-control-secret", { ...payload, agentUid: 9002 }, signature),
    false
  );
});
