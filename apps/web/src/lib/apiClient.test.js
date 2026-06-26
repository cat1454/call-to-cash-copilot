/**
 * Phase 6 API Client unit tests
 *
 * Uses Node's built-in mock module to simulate fetch responses.
 * These tests verify contract-correct request construction and error handling.
 * They do NOT test network or Fastify behaviour.
 */

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { ApiClientError, createApiClient } from "./apiClient.js";

const BASE_URL = "http://localhost:3001";

function mockFetch(status, body) {
  return mock.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }));
}

test("health returns data on 200 ok", async () => {
  const successBody = {
    success: true,
    data: { status: "ok", service: "api" },
    meta: { requestId: "r1" }
  };
  const fetchMock = mockFetch(200, successBody);
  const client = createApiClient(BASE_URL, fetchMock);

  const result = await client.health();
  assert.equal(result.status, "ok");
  assert.equal(result.service, "api");
  assert.equal(fetchMock.mock.calls[0].arguments[1].cache, "no-store");
});

test("health throws ApiClientError on 503", async () => {
  const errorBody = {
    success: false,
    error: { code: "DATABASE_UNAVAILABLE", message: "Database is not configured.", retryable: true }
  };
  const fetchMock = mockFetch(503, errorBody);
  const client = createApiClient(BASE_URL, fetchMock);

  await assert.rejects(
    () => client.health(),
    (err) => {
      assert.ok(err instanceof ApiClientError);
      assert.equal(err.code, "DATABASE_UNAVAILABLE");
      assert.equal(err.retryable, true);
      return true;
    }
  );
});

test("createCall sends correct sourceMode and channel purpose", async () => {
  const successBody = {
    success: true,
    data: {
      callId: "call_abc",
      status: "CREATED",
      channelName: "ctc_call_abc",
      sourceMode: "TRANSCRIPT_REPLAY",
      createdAt: "2026-06-20T10:00:00.000Z"
    },
    meta: { requestId: "r2" }
  };
  const fetchMock = mockFetch(201, successBody);
  const client = createApiClient(BASE_URL, fetchMock);

  const result = await client.createCall({ sourceMode: "TRANSCRIPT_REPLAY" });
  assert.equal(result.callId, "call_abc");
  assert.equal(result.status, "CREATED");

  // Verify the request body sent to fetch
  const firstCall = fetchMock.mock.calls[0];
  const url = firstCall.arguments[0];
  const init = firstCall.arguments[1];
  assert.equal(url, `${BASE_URL}/v1/calls`);
  const body = JSON.parse(init.body);
  assert.equal(body.sourceMode, "TRANSCRIPT_REPLAY");
  assert.equal(body.channelPurpose, "BOOKING");
});


test("startVoiceSession sends browser RTC readiness only after publishing", async () => {
  const fetchMock = mockFetch(200, {
    success: true,
    data: { status: "CONNECTED" },
    meta: { requestId: "r-start" }
  });
  const client = createApiClient(BASE_URL, fetchMock);

  await client.startVoiceSession("call_abc", {
    rtcConnected: true,
    microphonePublished: true,
    browserRtcUid: 10002
  });

  const firstCall = fetchMock.mock.calls[0];
  assert.equal(firstCall.arguments[0], `${BASE_URL}/v1/voice-sessions/call_abc/start`);
  assert.deepEqual(JSON.parse(firstCall.arguments[1].body), {
    rtcConnected: true,
    microphonePublished: true,
    browserRtcUid: 10002
  });
});

test("submitTranscriptTurn merges defaults correctly", async () => {
  const successBody = {
    success: true,
    data: { turnId: "turn_1", callId: "call_abc", accepted: true, analysisQueued: false },
    meta: { requestId: "r3" }
  };
  const fetchMock = mockFetch(202, successBody);
  const client = createApiClient(BASE_URL, fetchMock);

  await client.submitTranscriptTurn("call_abc", {
    clientTurnId: "turn-client-0001",
    sequenceNo: 1,
    speaker: "CUSTOMER",
    content: "Tôi muốn đặt vé"
  });

  const firstCall = fetchMock.mock.calls[0];
  const init = firstCall.arguments[1];
  const body = JSON.parse(init.body);
  assert.equal(body.turn.isFinal, true);
  assert.equal(body.turn.language, "vi-VN");
  assert.equal(body.turn.source, "REPLAY");
  assert.equal(body.turn.content, "Tôi muốn đặt vé");
});


test("confirmBooking sends Idempotency-Key header", async () => {
  const successBody = {
    success: true,
    data: {
      bookingId: "bk_1",
      status: "AGREEMENT_LOCKED",
      agreement: { agreementId: "agr_1", version: 1, hash: "abc" },
      paymentGate: "UNLOCKED"
    },
    meta: { requestId: "r4" }
  };
  const fetchMock = mockFetch(200, successBody);
  const client = createApiClient(BASE_URL, fetchMock);

  await client.confirmBooking(
    "bk_1",
    { agreementVersion: 1, confirmation: { method: "VOICE", text: "Đồng ý" } },
    "key-abc-123"
  );

  const firstCall = fetchMock.mock.calls[0];
  const init = firstCall.arguments[1];
  assert.equal(init.headers["Idempotency-Key"], "key-abc-123");
});

test("verifyReceipt appends candidateDepositAmountMinor query param", async () => {
  const successBody = {
    success: true,
    data: {
      bookingId: "bk_1",
      receiptId: "rcpt_1",
      status: "MISMATCH",
      agreementVersion: 1,
      proofHash: "def",
      verifiedAt: "2026-06-20T11:00:00.000Z"
    },
    meta: { requestId: "r5" }
  };
  const fetchMock = mockFetch(200, successBody);
  const client = createApiClient(BASE_URL, fetchMock);

  await client.verifyReceipt("rcpt_1", { candidateDepositAmountMinor: 1 });

  const firstCall = fetchMock.mock.calls[0];
  const url = firstCall.arguments[0];
  assert.ok(url.includes("candidateDepositAmountMinor=1"), `Expected query param in URL: ${url}`);
});

test("call end and mock payment commands preserve contract payloads", async () => {
  const responses = [
    { callId: "call_public1", status: "ENDED", endedAt: "2026-06-21T10:00:00.000Z" },
    {
      paymentIntentId: "pi_public01",
      bookingId: "bk_public01",
      amount: { currency: "VND", minor: 300000 },
      recipient: "mock-recipient-wallet",
      reference: "ref_public01"
    },
    {
      paymentIntentId: "pi_public01",
      bookingId: "bk_public01",
      status: "CONFIRMED",
      receiptId: "rcpt_public1"
    }
  ];
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: responses.shift(), meta: { requestId: "request-1" } })
  }));
  const client = createApiClient(BASE_URL, fetchMock);

  await client.endCall("call_public1", "CUSTOMER_ENDED");
  const intent = await client.createMockPayment({ bookingId: "bk_public01" }, "create-key");
  await client.verifyMockPayment(
    {
      paymentIntentId: intent.paymentIntentId,
      observedAmount: intent.amount,
      observedRecipient: intent.recipient,
      observedReference: intent.reference
    },
    "verify-key"
  );

  assert.deepEqual(JSON.parse(fetchMock.mock.calls[0].arguments[1].body), {
    reason: "CUSTOMER_ENDED"
  });
  assert.equal(fetchMock.mock.calls[1].arguments[1].headers["Idempotency-Key"], "create-key");
  assert.deepEqual(JSON.parse(fetchMock.mock.calls[2].arguments[1].body), {
    paymentIntentId: "pi_public01",
    observedAmount: { currency: "VND", minor: 300000 },
    observedRecipient: "mock-recipient-wallet",
    observedReference: "ref_public01"
  });
  assert.equal(fetchMock.mock.calls[2].arguments[1].headers["Idempotency-Key"], "verify-key");
});

test("mock payment verification rejects an empty server reference before fetch", async () => {
  const fetchMock = mockFetch(200, { success: true, data: {} });
  const client = createApiClient(BASE_URL, fetchMock);

  await assert.rejects(
    () =>
      client.verifyMockPayment(
        {
          paymentIntentId: "pi_public01",
          observedAmount: { currency: "VND", minor: 300000 },
          observedRecipient: "mock-recipient-wallet",
          observedReference: ""
        },
        "verify-key"
      ),
    (error) => error instanceof ApiClientError && error.code === "VALIDATION_ERROR"
  );
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("generic payment client uses provider-neutral create and verify routes", async () => {
  const responses = [
    {
      paymentIntentId: "pi_public01",
      bookingId: "bk_public01",
      provider: "solana_devnet"
    },
    {
      paymentIntentId: "pi_public01",
      bookingId: "bk_public01",
      status: "CONFIRMED",
      receiptId: "rcpt_public1"
    }
  ];
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: responses.shift(), meta: { requestId: "req-1" } })
  }));
  const client = createApiClient(BASE_URL, fetchMock);

  await client.createPayment({ bookingId: "bk_public01" }, "create-generic-key");
  await client.verifyPayment({ paymentIntentId: "pi_public01" }, "verify-generic-key");

  assert.equal(fetchMock.mock.calls[0].arguments[0], `${BASE_URL}/v1/payments/create`);
  assert.equal(fetchMock.mock.calls[1].arguments[0], `${BASE_URL}/v1/payments/verify`);
  assert.equal(
    fetchMock.mock.calls[1].arguments[1].headers["Idempotency-Key"],
    "verify-generic-key"
  );
});

test("ApiClientError carries code and retryable flag", () => {
  const err = new ApiClientError(422, {
    code: "PAYMENT_AMOUNT_MISMATCH",
    message: "Amount mismatch",
    retryable: false
  });
  assert.equal(err.status, 422);
  assert.equal(err.code, "PAYMENT_AMOUNT_MISMATCH");
  assert.equal(err.retryable, false);
  assert.ok(err instanceof Error);
});
