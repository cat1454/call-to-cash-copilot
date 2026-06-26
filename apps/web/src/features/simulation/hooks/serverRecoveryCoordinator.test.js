import assert from "node:assert/strict";
import test from "node:test";

import { EventName } from "@call-to-cash/shared";

import { recoveryHintsForEvent } from "./serverRecovery.js";
import { createSingleFlightRecovery } from "./serverRecoveryCoordinator.js";

test("single-flight recovery coalesces concurrent requests and runs the newest queued hint once", async () => {
  const calls = [];
  const completions = [];
  let resolveFirst;
  const recover = (callId, hints) => {
    calls.push({ callId, hints });
    if (calls.length === 1) return new Promise((resolve) => (resolveFirst = resolve));
    return Promise.resolve();
  };
  const coordinator = createSingleFlightRecovery(recover);

  const first = coordinator.request("call_public1", { bookingId: "bk_first" });
  const second = coordinator.request("call_public1", { receiptId: "rcpt_latest" });
  first.then(() => completions.push("first"));
  second.then(() => completions.push("second"));

  assert.deepEqual(calls, [{ callId: "call_public1", hints: { bookingId: "bk_first" } }]);
  resolveFirst({ bookingId: "bk_first" });
  await Promise.all([first, second]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, [
    { callId: "call_public1", hints: { bookingId: "bk_first" } },
    { callId: "call_public1", hints: { receiptId: "rcpt_latest" } }
  ]);
  assert.deepEqual(completions.sort(), ["first", "second"]);
});

test("booking and receipt events request authoritative recovery with only opaque identifiers", () => {
  assert.deepEqual(
    recoveryHintsForEvent(EventName.TranscriptAnalysisUpdated, {
      bookingId: "bk_public01",
      data: { extractionId: "ext_public01", understood: { contactPhone: "0901567890" } }
    }),
    { bookingId: "bk_public01" }
  );
  assert.deepEqual(
    recoveryHintsForEvent(EventName.BookingUpdated, {
      bookingId: "bk_public01",
      data: { changedFields: ["passengerCount"] }
    }),
    { bookingId: "bk_public01" }
  );
  assert.deepEqual(
    recoveryHintsForEvent(EventName.ReceiptCreated, {
      bookingId: "bk_public01",
      data: { receiptId: "rcpt_public01" }
    }),
    { bookingId: "bk_public01", receiptId: "rcpt_public01" }
  );
  assert.equal(
    recoveryHintsForEvent(EventName.TranscriptTurnCreated, {
      bookingId: "bk_public01",
      data: { content: "private transcript" }
    }),
    null
  );
});
