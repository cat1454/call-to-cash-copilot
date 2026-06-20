import assert from "node:assert/strict";
import test from "node:test";

import { createPrismaClient } from "@call-to-cash/db";

import {
  createMockPaymentExpectation,
  validateMockPaymentObservation
} from "./platform/providers/mock-payment-provider.js";
import { buildApp } from "./app.js";
import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  ErrorCodeSchema,
  EventName,
  PaymentGateStatus
} from "@call-to-cash/shared";

const databaseUrl = process.env.TEST_DATABASE_URL;

const demoConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3001,
  demoMode: true,
  paymentProvider: "mock",
  voiceProvider: "replay",
  aiProvider: "deterministic",
  logLevel: "silent" as const,
  rateLimitMax: 0
} as const;

if (databaseUrl !== undefined) {
  process.env.DATABASE_URL = databaseUrl;
}

function phase5SkipReason() {
  return databaseUrl === undefined ? "TEST_DATABASE_URL is not configured" : false;
}

test("mock payment provider validates server-owned amount, recipient, and reference", () => {
  const expectation = createMockPaymentExpectation("ref_payment_test", "agreement-hash");
  const base = {
    expectedAmountMinor: 300_000,
    expectedRecipient: expectation.recipient,
    expectedReference: expectation.reference,
    observedAmountMinor: 300_000,
    observedRecipient: expectation.recipient,
    observedReference: expectation.reference
  };
  assert.equal(validateMockPaymentObservation(base), null);
  assert.equal(
    validateMockPaymentObservation({ ...base, observedAmountMinor: 299_999 }),
    "PAYMENT_AMOUNT_MISMATCH"
  );
  assert.equal(
    validateMockPaymentObservation({ ...base, observedRecipient: "wrong-recipient" }),
    "PAYMENT_RECIPIENT_MISMATCH"
  );
  assert.equal(
    validateMockPaymentObservation({ ...base, observedReference: "" }),
    "PAYMENT_REFERENCE_MISMATCH"
  );
});

function uniqueSuffix(): string {
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

async function seedFutureDeparture() {
  assert.ok(databaseUrl);
  const prisma = createPrismaClient({ databaseUrl });
  const suffix = uniqueSuffix();

  await prisma.$transaction([
    prisma.trustReceipt.deleteMany(),
    prisma.proofRecord.deleteMany(),
    prisma.paymentTransaction.deleteMany(),
    prisma.paymentIntent.deleteMany(),
    prisma.agreement.deleteMany(),
    prisma.inventoryHold.deleteMany(),
    prisma.riskAssessment.deleteMany(),
    prisma.bookingExtraction.deleteMany(),
    prisma.consentRecord.deleteMany(),
    prisma.transcriptTurn.deleteMany(),
    prisma.callSession.updateMany({ data: { bookingId: null } }),
    prisma.booking.deleteMany(),
    prisma.callSession.deleteMany(),
    prisma.tripDeparture.deleteMany()
  ]);
  await prisma.tripDeparture.create({
    data: {
      publicId: `dep_${suffix}`,
      routeCode: `HN-SAPA-P5-${suffix}`,
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: new Date("2030-06-20T15:30:00.000Z"),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 36,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 300_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    }
  });

  await prisma.$disconnect();
}

function parseSseEvents(payload: string) {
  return payload
    .split("\n\n")
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      assert.ok(dataLine);
      return JSON.parse(dataLine.slice("data: ".length));
    });
}

async function createReplayBooking(app: ReturnType<typeof buildApp>) {
  await seedFutureDeparture();

  const callResponse = await app.inject({
    method: "POST",
    url: "/v1/calls",
    payload: {
      channelPurpose: "BOOKING",
      sourceMode: "TRANSCRIPT_REPLAY"
    }
  });
  assert.equal(callResponse.statusCode, 201);
  const call = callResponse.json().data;

  const turnResponse = await app.inject({
    method: "POST",
    url: `/v1/calls/${call.callId}/transcript-turns`,
    payload: {
      turn: {
        clientTurnId: `turn-client-${uniqueSuffix()}`,
        sequenceNo: 1,
        speaker: "CUSTOMER",
        content: "Tôi muốn đặt 3 vé Hà Nội đi Sa Pa chuyến 22:30, đón ở Mỹ Đình, số 0912345678.",
        language: "vi-VN",
        isFinal: true,
        source: "REPLAY"
      }
    }
  });
  assert.equal(turnResponse.statusCode, 202);

  const callReadResponse = await app.inject({
    method: "GET",
    url: `/v1/calls/${call.callId}`
  });
  assert.equal(callReadResponse.statusCode, 200);
  const callRead = callReadResponse.json().data;
  assert.ok(callRead.booking);

  return {
    callId: call.callId as string,
    bookingId: callRead.booking.bookingId as string
  };
}

async function confirmReplayBooking(app: ReturnType<typeof buildApp>) {
  const replay = await createReplayBooking(app);
  const confirmationKey = `confirm-${uniqueSuffix()}`;
  const confirmResponse = await app.inject({
    method: "POST",
    url: `/v1/bookings/${replay.bookingId}/confirm`,
    headers: { "Idempotency-Key": confirmationKey },
    payload: {
      agreementVersion: 1,
      confirmation: {
        method: "VOICE",
        text: "Tôi xác nhận giữ chỗ và đồng ý cọc 300 nghìn theo chính sách BUS-V1."
      }
    }
  });

  assert.equal(confirmResponse.statusCode, 200);
  assert.equal(confirmResponse.json().data.paymentGate, PaymentGateStatus.Unlocked);

  return { ...replay, confirmationKey };
}

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

test(
  "Phase 5 replay persists call, transcript, booking risk and recoverable SSE events",
  { skip: phase5SkipReason() },
  async () => {
    const app = buildApp(demoConfig);
    const { callId, bookingId } = await createReplayBooking(app);

    const riskResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${callId}/risk`
    });
    assert.equal(riskResponse.statusCode, 200);
    const risk = riskResponse.json().data;
    assert.equal(risk.callId, callId);
    assert.equal(risk.bookingId, bookingId);
    assert.notEqual(risk.paymentGate, PaymentGateStatus.Unlocked);
    assert.ok(risk.reasonCodes.includes("REFUND_POLICY_NOT_CONFIRMED"));

    const eventResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${callId}/events?snapshot=true`,
      headers: { accept: "text/event-stream" }
    });
    assert.equal(eventResponse.statusCode, 200);
    assert.match(eventResponse.headers["content-type"] as string, /text\/event-stream/);
    const events = parseSseEvents(eventResponse.payload);
    assert.deepEqual(
      events.map((event) => event.event),
      [
        EventName.CallCreated,
        EventName.TranscriptTurnCreated,
        EventName.BookingUpdated,
        EventName.RiskScoreUpdated,
        EventName.RiskPaymentGateUpdated
      ]
    );
    assert.equal(events[1].data.content.includes("0912345678"), false);

    const replayResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${callId}/events?snapshot=true`,
      headers: {
        accept: "text/event-stream",
        "last-event-id": events[0].eventId
      }
    });
    assert.equal(replayResponse.statusCode, 200);
    assert.deepEqual(
      parseSseEvents(replayResponse.payload).map((event) => event.event),
      [
        EventName.TranscriptTurnCreated,
        EventName.BookingUpdated,
        EventName.RiskScoreUpdated,
        EventName.RiskPaymentGateUpdated
      ]
    );

    const bookingResponse = await app.inject({
      method: "GET",
      url: `/v1/bookings/${bookingId}`
    });
    assert.equal(bookingResponse.statusCode, 200);
    assert.equal(bookingResponse.json().data.status, "AGREEMENT_READY");

    const endResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${callId}/end`,
      payload: { reason: "CUSTOMER_ENDED" }
    });
    assert.equal(endResponse.statusCode, 200);
    assert.equal(endResponse.json().data.status, "ENDED");

    const endedEventResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${callId}/events?snapshot=true`,
      headers: {
        accept: "text/event-stream",
        "last-event-id": events.at(-1)?.eventId
      }
    });
    assert.deepEqual(
      parseSseEvents(endedEventResponse.payload).map((event) => event.event),
      [EventName.CallEnded]
    );

    await app.close();
  }
);

test(
  "Phase 5 SSE connection stays open and receives events committed after subscription",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const app = buildApp(demoConfig);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const controller = new AbortController();
    try {
      const callResponse = await fetch(`${address}/v1/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelPurpose: "BOOKING",
          sourceMode: "TRANSCRIPT_REPLAY"
        })
      });
      const call = (await callResponse.json()).data;
      const eventResponse = await fetch(`${address}/v1/calls/${call.callId}/events`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal
      });
      assert.equal(eventResponse.status, 200);
      assert.ok(eventResponse.body);
      const reader = eventResponse.body.getReader();
      const decoder = new TextDecoder();
      const initial = await reader.read();
      assert.equal(initial.done, false);
      assert.match(decoder.decode(initial.value), /event: call\.created/);

      const turnResponse = await fetch(`${address}/v1/calls/${call.callId}/transcript-turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turn: {
            clientTurnId: `turn-client-${uniqueSuffix()}`,
            sequenceNo: 1,
            speaker: "CUSTOMER",
            content:
              "Tôi muốn đặt 3 vé Hà Nội đi Sa Pa chuyến 22:30, đón ở Mỹ Đình, số 0912345678.",
            language: "vi-VN",
            isFinal: true,
            source: "REPLAY"
          }
        })
      });
      assert.equal(turnResponse.status, 202);

      let streamed = "";
      while (!streamed.includes("risk.payment_gate.updated")) {
        const next = await reader.read();
        assert.equal(next.done, false);
        streamed += decoder.decode(next.value);
      }
      assert.match(streamed, /event: transcript\.turn\.created/);
      assert.match(streamed, /event: risk\.score\.updated/);
    } finally {
      controller.abort();
      await app.close();
    }
  }
);

test(
  "Phase 5 confirms booking, creates idempotent mock payment and issues safe receipt",
  { skip: phase5SkipReason() },
  async () => {
    const app = buildApp(demoConfig);
    const { bookingId, confirmationKey } = await confirmReplayBooking(app);

    const confirmationConflictResponse = await app.inject({
      method: "POST",
      url: `/v1/bookings/${bookingId}/confirm`,
      headers: { "Idempotency-Key": confirmationKey },
      payload: {
        agreementVersion: 1,
        confirmation: {
          method: "VOICE",
          text: "Payload changed after this idempotency key was used."
        }
      }
    });
    assert.equal(confirmationConflictResponse.statusCode, 409);
    assert.equal(
      confirmationConflictResponse.json().error.code,
      ErrorCodeSchema.enum.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
    );

    const paymentCreateResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": `payment-${uniqueSuffix()}` },
      payload: { bookingId }
    });
    assert.equal(paymentCreateResponse.statusCode, 201);
    const payment = paymentCreateResponse.json().data;

    const paymentReplayResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": payment.idempotencyKey },
      payload: { bookingId }
    });
    assert.equal(paymentReplayResponse.statusCode, 200);
    assert.equal(paymentReplayResponse.json().data.paymentIntentId, payment.paymentIntentId);

    const paymentConflictResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": payment.idempotencyKey },
      payload: { bookingId: "bk_nonexistent_phase5" }
    });
    assert.equal(paymentConflictResponse.statusCode, 409);
    assert.equal(
      paymentConflictResponse.json().error.code,
      ErrorCodeSchema.enum.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
    );

    const missingVerifyKeyResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      payload: {
        paymentIntentId: payment.paymentIntentId,
        observedAmount: payment.amount,
        observedRecipient: payment.recipient,
        observedReference: payment.reference
      }
    });
    assert.equal(missingVerifyKeyResponse.statusCode, 400);
    assert.equal(
      missingVerifyKeyResponse.json().error.code,
      ErrorCodeSchema.enum.INVALID_IDEMPOTENCY_KEY
    );

    const verifyIdempotencyKey = `verify-${uniqueSuffix()}`;
    const verifyResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      headers: { "Idempotency-Key": verifyIdempotencyKey },
      payload: {
        paymentIntentId: payment.paymentIntentId,
        observedAmount: payment.amount,
        observedRecipient: payment.recipient,
        observedReference: payment.reference
      }
    });
    assert.equal(verifyResponse.statusCode, 200);
    const verification = verifyResponse.json().data;
    assert.equal(verification.status, "CONFIRMED");
    assert.ok(verification.receiptId);

    const verifyReplayResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      headers: { "Idempotency-Key": verifyIdempotencyKey },
      payload: {
        paymentIntentId: payment.paymentIntentId,
        observedAmount: payment.amount,
        observedRecipient: payment.recipient,
        observedReference: payment.reference
      }
    });
    assert.equal(verifyReplayResponse.statusCode, 200);
    assert.equal(verifyReplayResponse.json().data.receiptId, verification.receiptId);

    const verifyConflictResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      headers: { "Idempotency-Key": verifyIdempotencyKey },
      payload: {
        paymentIntentId: payment.paymentIntentId,
        observedAmount: { currency: "VND", minor: payment.amount.minor - 1 },
        observedRecipient: payment.recipient,
        observedReference: payment.reference
      }
    });
    assert.equal(verifyConflictResponse.statusCode, 409);
    assert.equal(
      verifyConflictResponse.json().error.code,
      ErrorCodeSchema.enum.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
    );

    const statusResponse = await app.inject({
      method: "GET",
      url: `/v1/payments/${bookingId}/status`
    });
    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().data.status, "CONFIRMED");

    const receiptResponse = await app.inject({
      method: "GET",
      url: `/v1/receipts/${verification.receiptId}`
    });
    assert.equal(receiptResponse.statusCode, 200);
    const serializedReceipt = JSON.stringify(receiptResponse.json());
    assert.match(serializedReceipt, /0912\*\*\*678/);
    assert.doesNotMatch(serializedReceipt, /0912345678/);
    assert.doesNotMatch(serializedReceipt, /Tôi muốn đặt/);

    const receiptVerifyResponse = await app.inject({
      method: "GET",
      url: `/v1/receipts/${verification.receiptId}/verify`
    });
    assert.equal(receiptVerifyResponse.statusCode, 200);
    assert.equal(receiptVerifyResponse.json().data.status, "MATCH");

    await app.close();
  }
);

test(
  "Phase 5 mock verification fails closed and tamper verification never mutates locked agreement",
  { skip: phase5SkipReason() },
  async () => {
    assert.ok(databaseUrl);
    const app = buildApp(demoConfig);
    const { bookingId } = await confirmReplayBooking(app);
    const paymentCreateResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": `payment-${uniqueSuffix()}` },
      payload: { bookingId }
    });
    const payment = paymentCreateResponse.json().data;

    const mismatchResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      headers: { "Idempotency-Key": `verify-${uniqueSuffix()}` },
      payload: {
        paymentIntentId: payment.paymentIntentId,
        observedAmount: { currency: "VND", minor: payment.amount.minor - 1 },
        observedRecipient: payment.recipient,
        observedReference: payment.reference
      }
    });
    assert.equal(mismatchResponse.statusCode, 422);
    assert.equal(mismatchResponse.json().error.code, ErrorCodeSchema.enum.PAYMENT_AMOUNT_MISMATCH);
    const mismatchStatusResponse = await app.inject({
      method: "GET",
      url: `/v1/payments/${bookingId}/status`
    });
    assert.equal(mismatchStatusResponse.statusCode, 200);
    assert.equal(mismatchStatusResponse.json().data.status, "REJECTED");
    const mismatchCall = await app.inject({
      method: "GET",
      url: `/v1/bookings/${bookingId}`
    });
    assert.equal(mismatchCall.json().data.status, "MANUAL_REVIEW_REQUIRED");

    const prisma = createPrismaClient({ databaseUrl });
    const failedEvents = await prisma.auditLog.count({
      where: {
        aggregateType: "CALL_STREAM",
        action: "EVENT_PAYMENT_FAILED",
        metadata: { path: ["event"], equals: EventName.PaymentFailed }
      }
    });
    assert.ok(failedEvents > 0);
    await prisma.$disconnect();

    const happyApp = buildApp(demoConfig);
    const { bookingId: happyBookingId } = await confirmReplayBooking(happyApp);
    const happyPaymentResponse = await happyApp.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": `payment-${uniqueSuffix()}` },
      payload: { bookingId: happyBookingId }
    });
    const happyPayment = happyPaymentResponse.json().data;
    const happyVerifyResponse = await happyApp.inject({
      method: "POST",
      url: "/v1/payments/mock/verify",
      headers: { "Idempotency-Key": `verify-${uniqueSuffix()}` },
      payload: {
        paymentIntentId: happyPayment.paymentIntentId,
        observedAmount: happyPayment.amount,
        observedRecipient: happyPayment.recipient,
        observedReference: happyPayment.reference
      }
    });
    const receiptId = happyVerifyResponse.json().data.receiptId;

    const prismaBeforeTamper = createPrismaClient({ databaseUrl });
    const agreementBefore = await prismaBeforeTamper.agreement.findFirstOrThrow({
      where: { booking: { publicId: happyBookingId } },
      orderBy: { version: "desc" }
    });
    await prismaBeforeTamper.$disconnect();

    const tamperResponse = await happyApp.inject({
      method: "GET",
      url: `/v1/receipts/${receiptId}/verify?candidateDepositAmountMinor=1`
    });
    assert.equal(tamperResponse.statusCode, 200, JSON.stringify(tamperResponse.json()));
    assert.equal(tamperResponse.json().data.status, "MISMATCH");
    assert.equal(tamperResponse.json().data.nextAction, "MANUAL_REVIEW");

    const prismaAfter = createPrismaClient({ databaseUrl });
    const agreementAfter = await prismaAfter.agreement.findUniqueOrThrow({
      where: { id: agreementBefore.id }
    });
    await prismaAfter.$disconnect();

    assert.deepEqual(agreementAfter.canonicalPayload, agreementBefore.canonicalPayload);
    assert.equal(agreementAfter.payloadHashSha256, agreementBefore.payloadHashSha256);

    await app.close();
    await happyApp.close();
  }
);

test("GET /ready reports explicit demo providers", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "GET", url: "/ready" });

  if (databaseUrl === undefined) {
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, ErrorCodeSchema.enum.DATABASE_UNAVAILABLE);
    await app.close();
    return;
  }

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
    },
    dependencies: { database: "ready" }
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
