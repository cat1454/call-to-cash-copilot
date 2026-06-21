import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearServerSession,
  readServerSession,
  shouldPersistServerSession,
  writeServerSession
} from "./serverSession.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

test("server session persists only opaque identifiers needed for refresh recovery", () => {
  const storage = memoryStorage();
  writeServerSession(storage, {
    callId: "call_public1",
    bookingId: "bk_public01",
    paymentIntentId: "pi_public01",
    contactPhone: "0912345678",
    transcript: "private transcript",
    canonicalAgreement: "private agreement"
  });

  const restored = readServerSession(storage);
  assert.deepEqual(restored, {
    callId: "call_public1",
    bookingId: "bk_public01",
    paymentIntentId: "pi_public01"
  });
  const serialized = JSON.stringify(restored);
  assert.doesNotMatch(serialized, /0912345678|private transcript|private agreement/);

  clearServerSession(storage);
  assert.equal(readServerSession(storage), null);
});

test("server session rejects malformed or non-call recovery records", () => {
  const storage = memoryStorage();
  storage.setItem("call-to-cash:server-session:v1", JSON.stringify({ callId: "bk_wrong" }));
  assert.equal(readServerSession(storage), null);
});

test("reload keeps in-progress payment but starts fresh after receipt or manual review", () => {
  const storage = memoryStorage();
  writeServerSession(storage, {
    callId: "call_public1",
    receiptId: "rcpt_public1"
  });
  assert.equal(readServerSession(storage), null);

  assert.equal(
    shouldPersistServerSession({
      callId: "call_public1",
      paymentIntentId: "pi_public01",
      receiptId: null,
      paymentGate: "UNLOCKED"
    }),
    true
  );
  assert.equal(
    shouldPersistServerSession({
      callId: "call_public1",
      receiptId: "rcpt_public1",
      paymentGate: "UNLOCKED"
    }),
    false
  );
  assert.equal(
    shouldPersistServerSession({
      callId: "call_public1",
      receiptId: null,
      paymentGate: "MANUAL_REVIEW_REQUIRED"
    }),
    false
  );
});
