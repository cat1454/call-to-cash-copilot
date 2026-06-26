import assert from "node:assert/strict";
import { test } from "node:test";

import { recoverServerState } from "./serverRecovery.js";
import { ACTION, makeInitialState } from "./serverSimulationState.js";

test("refresh recovery reloads authoritative booking, payment, and receipt read models", async () => {
  const calls = [];
  const apiClient = {
    getCall: async (callId) => {
      calls.push(["call", callId]);
      return { callId, status: "ENDED", booking: { bookingId: "bk_public01" } };
    },
    getTranscript: async (callId) => {
      calls.push(["transcript", callId]);
      return { callId, turns: [] };
    },
    getRisk: async (callId) => {
      calls.push(["risk", callId]);
      return {
        completenessScore: 100,
        disputeRisk: 0,
        paymentReadiness: 100,
        paymentGate: "UNLOCKED"
      };
    },
    getBooking: async (bookingId) => {
      calls.push(["booking", bookingId]);
      return { bookingId, status: "RECEIPT_ISSUED", contactPhoneMasked: "0912***678" };
    },
    getPaymentStatus: async (bookingId) => {
      calls.push(["payment", bookingId]);
      return { bookingId, paymentIntentId: "pi_public01", status: "CONFIRMED" };
    },
    getReceipt: async (receiptId) => {
      calls.push(["receipt", receiptId]);
      return { receiptId, bookingId: "bk_public01", status: "VERIFIED_MATCH" };
    },
    verifyReceipt: async (receiptId) => {
      calls.push(["verification", receiptId]);
      return { receiptId, bookingId: "bk_public01", status: "MATCH" };
    }
  };
  const actions = [];

  await recoverServerState(
    apiClient,
    (action) => actions.push(action),
    makeInitialState(),
    "call_public1",
    {
      bookingId: "bk_public01",
      paymentIntentId: "pi_public01",
      receiptId: "rcpt_public1"
    }
  );

  assert.deepEqual(calls, [
    ["call", "call_public1"],
    ["transcript", "call_public1"],
    ["risk", "call_public1"],
    ["booking", "bk_public01"],
    ["payment", "bk_public01"],
    ["receipt", "rcpt_public1"],
    ["verification", "rcpt_public1"]
  ]);
  assert.deepEqual(
    actions.map((action) => action.type),
    [
      ACTION.CALL_SYNCED,
      ACTION.TRANSCRIPT_SYNCED,
      ACTION.RISK_SYNCED,
      ACTION.BOOKING_SYNCED,
      ACTION.PAYMENT_STATUS_SYNCED,
      ACTION.RECEIPT_SYNCED,
      ACTION.VERIFICATION_SYNCED,
      ACTION.RECOVERY_COMPLETE
    ]
  );
});

test("recovery does not request risk before a booking exists", async () => {
  let riskRequests = 0;
  const actions = [];
  const apiClient = {
    getCall: async (callId) => ({ callId, status: "ACTIVE", booking: null }),
    getTranscript: async (callId) => ({ callId, turns: [] }),
    getRisk: async () => {
      riskRequests += 1;
      throw new Error("Risk is not ready");
    }
  };

  await recoverServerState(
    apiClient,
    (action) => actions.push(action),
    makeInitialState(),
    "call_public2"
  );

  assert.equal(riskRequests, 0);
  assert.deepEqual(
    actions.map((action) => action.type),
    [ACTION.CALL_SYNCED, ACTION.TRANSCRIPT_SYNCED, ACTION.RECOVERY_COMPLETE]
  );
});
