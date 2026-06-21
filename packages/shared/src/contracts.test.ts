import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  BookingIdSchema,
  BookingStatus,
  CallIdSchema,
  ConfirmBookingRequestSchema,
  CreateBookingRequestSchema,
  CreateCallRequestSchema,
  CreatePaymentIntentResponseSchema,
  CreateMockPaymentIntentRequestSchema,
  CreateTranscriptTurnRequestSchema,
  EventEnvelopeSchema,
  EventName,
  EventNameSchema,
  PaymentStatusResponseSchema,
  PaymentGateStatus,
  ProofRecordSchema,
  ReceiptSummarySchema,
  RiskAnalysisRequestSchema,
  TranscriptTurnSubmissionSchema,
  VerifyPaymentRequestSchema,
  VerifySolanaPaymentRequestSchema
} from "./index.js";

const isoTimestamp = "2026-06-20T10:30:00.000Z";

test("public ID schemas accept only their documented prefixes", () => {
  assert.equal(CallIdSchema.safeParse("call_01JTEST0001").success, true);
  assert.equal(BookingIdSchema.safeParse("bk_01JTEST0001").success, true);
  assert.equal(CallIdSchema.safeParse("bk_01JTEST0001").success, false);
  assert.equal(BookingIdSchema.safeParse("booking_01JTEST0001").success, false);
});

test("replay command schemas accept customer input but reject client authority fields", () => {
  const call = CreateCallRequestSchema.safeParse({
    channelPurpose: "BOOKING",
    sourceMode: "TRANSCRIPT_REPLAY",
    customerId: "usr_customer_demo"
  });
  assert.equal(call.success, true);

  const transcript = TranscriptTurnSubmissionSchema.safeParse({
    callId: "call_01JTEST0001",
    turn: {
      clientTurnId: "turn_client_0007",
      sequenceNo: 7,
      speaker: "CUSTOMER",
      content: "Tôi muốn đặt 3 vé.",
      language: "vi-VN",
      isFinal: true,
      startedAt: isoTimestamp,
      endedAt: isoTimestamp,
      sttConfidence: 0.94,
      source: "REPLAY"
    }
  });
  assert.equal(transcript.success, true);

  const booking = CreateBookingRequestSchema.safeParse({
    callId: "call_01JTEST0001",
    routeFrom: "Ha Noi",
    routeTo: "Sa Pa",
    departureAt: "2026-06-20T22:30:00+07:00",
    passengerCount: 3,
    pickupPoint: "My Dinh",
    contactPhone: "0912345678"
  });
  assert.equal(booking.success, true);

  assert.equal(
    CreateBookingRequestSchema.safeParse({ ...booking.data, status: "PAYMENT_CONFIRMED" }).success,
    false
  );
  assert.equal(
    RiskAnalysisRequestSchema.safeParse({
      callId: "call_01JTEST0001",
      mode: "LATEST_FINAL_TURNS",
      paymentGate: "UNLOCKED"
    }).success,
    false
  );
  assert.equal(
    ConfirmBookingRequestSchema.safeParse({
      agreementVersion: 1,
      confirmation: { method: "VOICE", text: "Tôi xác nhận" },
      status: "AGREEMENT_LOCKED"
    }).success,
    false
  );
});

test("API envelopes are serializable and distinguish safe success from safe errors", () => {
  const success = ApiSuccessEnvelopeSchema.safeParse({
    success: true,
    data: { callId: "call_01JTEST0001" },
    meta: { requestId: "req_01JTEST0001" }
  });
  assert.equal(success.success, true);
  assert.deepEqual(success.data, {
    success: true,
    data: { callId: "call_01JTEST0001" },
    meta: { requestId: "req_01JTEST0001" }
  });

  const error = ApiErrorEnvelopeSchema.safeParse({
    success: false,
    error: {
      code: "PAYMENT_GATE_LOCKED",
      message: "Payment cannot be created.",
      requestId: "req_01JTEST0001",
      retryable: false
    }
  });
  assert.equal(error.success, true);
  assert.equal(
    ApiErrorEnvelopeSchema.safeParse({
      success: false,
      error: { code: "NOT_A_DOCUMENTED_ERROR", message: "no", retryable: false }
    }).success,
    false
  );
});

test("event envelopes use stable names and reject unapproved event fields", () => {
  const event = EventEnvelopeSchema.safeParse({
    eventId: "evt_01JTEST0001",
    event: EventName.RiskScoreUpdated,
    version: 1,
    occurredAt: isoTimestamp,
    correlationId: "req_01JTEST0001",
    callId: "call_01JTEST0001",
    bookingId: "bk_01JTEST0001",
    sequence: 18,
    data: {
      assessmentId: "risk_01JTEST0001",
      completenessScore: 82,
      disputeRisk: 20,
      paymentReadiness: 65,
      paymentGate: PaymentGateStatus.Locked,
      nextAction: "ASK_CLARIFICATION",
      missingFields: ["departureAt"],
      reasonCodes: ["MISSING_DEPARTURE_TIME"],
      customerMessage: "Cần xác nhận giờ khởi hành."
    }
  });
  assert.equal(event.success, true);
  assert.equal(
    EventEnvelopeSchema.safeParse({ ...event.data, event: "payment.approved" }).success,
    false
  );
  assert.equal(
    EventEnvelopeSchema.safeParse({
      eventId: "evt_01JTEST0002",
      event: EventName.AgreementLocked,
      version: 1,
      occurredAt: isoTimestamp,
      correlationId: "req_01JTEST0001",
      callId: "call_01JTEST0001",
      bookingId: "bk_01JTEST0001",
      sequence: 19,
      data: {
        status: "AGREEMENT_LOCKED",
        agreementId: "agr_01JTEST0001",
        agreementVersion: 1,
        paymentGate: "UNLOCKED"
      }
    }).success,
    true
  );
  assert.equal(EventName.AgreementLocked, "agreement.locked");
  assert.equal(EventNameSchema.safeParse("booking.confirmed").success, false);
});

test("payment pending event allows reference discovery before a signature exists", () => {
  const event = EventEnvelopeSchema.safeParse({
    eventId: "evt_01JTEST0003",
    event: EventName.PaymentPending,
    version: 1,
    occurredAt: isoTimestamp,
    correlationId: "req_01JTEST0001",
    callId: "call_01JTEST0001",
    bookingId: "bk_01JTEST0001",
    sequence: 20,
    data: {
      paymentIntentId: "pi_01JTEST0001",
      status: "PENDING"
    }
  });

  assert.equal(event.success, true);
});

test("Phase 5 nested replay and mock-payment DTOs reject authority fields", () => {
  assert.equal(
    CreateTranscriptTurnRequestSchema.safeParse({
      turn: {
        clientTurnId: "turn-client-1",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        content: "Tôi muốn đặt 3 vé.",
        language: "vi-VN",
        isFinal: true,
        source: "REPLAY"
      }
    }).success,
    true
  );
  assert.equal(
    CreateMockPaymentIntentRequestSchema.safeParse({
      bookingId: "bk_01JTEST0001",
      status: "CONFIRMED"
    }).success,
    false
  );
});

test("Phase 8 payment DTOs expose only Devnet request data and allow server discovery", () => {
  const response = CreatePaymentIntentResponseSchema.safeParse({
    paymentIntentId: "pi_01JTEST0001",
    bookingId: "bk_01JTEST0001",
    agreementId: "agr_01JTEST0001",
    status: "CREATED",
    amount: { currency: "VND", minor: 300000 },
    recipient: "11111111111111111111111111111111",
    reference: "11111111111111111111111111111111",
    expiresAt: isoTimestamp,
    idempotencyKey: "phase8-create-key",
    provider: "solana_devnet",
    providerPayment: {
      provider: "solana_devnet",
      cluster: "devnet",
      amountLamports: 1000000,
      amountSol: "0.001",
      solanaPayUrl:
        "solana:11111111111111111111111111111111?amount=0.001&reference=11111111111111111111111111111111",
      qrPayload:
        "solana:11111111111111111111111111111111?amount=0.001&reference=11111111111111111111111111111111",
      memo: "ctc:v1:ref:1111111111:proof:aaaaaaaaaaaa:amt:lfls"
    }
  });

  assert.equal(response.success, true);
  assert.equal(
    CreatePaymentIntentResponseSchema.safeParse({
      ...response.data,
      providerPayment: { ...response.data?.providerPayment, rawPhone: "0912345678" }
    }).success,
    false
  );
  assert.equal(
    VerifySolanaPaymentRequestSchema.safeParse({
      paymentIntentId: "pi_01JTEST0001"
    }).success,
    true
  );
  assert.equal(
    VerifyPaymentRequestSchema.safeParse({
      paymentIntentId: "pi_01JTEST0001",
      transactionSignature: "2".repeat(88),
      confirmed: true
    }).success,
    false
  );
});

test("public proof contracts reject PII and expose only approved verification metadata", () => {
  const proof = ProofRecordSchema.safeParse({
    proofId: "proof_01JTEST0001",
    bookingId: "bk_01JTEST0001",
    agreementId: "agr_01JTEST0001",
    proofHash: "a".repeat(64),
    anchorType: "SERVER_ATTESTATION",
    anchorValue: "attestation_01JTEST0001",
    verificationStatus: "PENDING",
    createdAt: isoTimestamp
  });
  assert.equal(proof.success, true);
  assert.equal(
    ProofRecordSchema.safeParse({ ...proof.data, customerPhone: "0912345678" }).success,
    false
  );
});

test("shared state constants follow the canonical state-machine vocabulary", () => {
  assert.equal(BookingStatus.Draft, "DRAFT");
  assert.equal(BookingStatus.AgreementLocked, "AGREEMENT_LOCKED");
  assert.equal(BookingStatus.ReceiptIssued, "RECEIPT_ISSUED");
  assert.equal(PaymentGateStatus.Unlocked, "UNLOCKED");
});

test("payment and receipt response DTOs reject undocumented status strings", () => {
  assert.equal(
    PaymentStatusResponseSchema.safeParse({
      bookingId: "bk_01JTEST0001",
      paymentIntentId: "pi_01JTEST0001",
      status: "CONFIRMED",
      transactionSignature: null,
      verifiedAt: null,
      nextAction: "ISSUE_RECEIPT"
    }).success,
    true
  );
  assert.equal(
    PaymentStatusResponseSchema.safeParse({
      bookingId: "bk_01JTEST0001",
      paymentIntentId: "pi_01JTEST0001",
      status: "SETTLED",
      transactionSignature: null,
      verifiedAt: null,
      nextAction: "ISSUE_RECEIPT"
    }).success,
    false
  );
  assert.equal(
    ReceiptSummarySchema.safeParse({
      receiptId: "rcpt_01JTEST0001",
      bookingId: "bk_01JTEST0001",
      status: "ISSUED"
    }).success,
    true
  );
  assert.equal(
    ReceiptSummarySchema.safeParse({
      receiptId: "rcpt_01JTEST0001",
      bookingId: "bk_01JTEST0001",
      status: "DELIVERED"
    }).success,
    false
  );
});
