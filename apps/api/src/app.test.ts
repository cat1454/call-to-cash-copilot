import assert from "node:assert/strict";
import test from "node:test";

import { createPrismaClient, type DatabaseClient } from "@call-to-cash/db";
import {
  SolanaDevnetPaymentProvider,
  encodeBase58,
  type SolanaParsedTransaction,
  type SolanaRpcClient
} from "@call-to-cash/solana";

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
  webOrigin: "",
  demoMode: true,
  paymentProvider: "mock",
  solanaDevnet: {
    cluster: "devnet",
    rpcUrl: "https://api.devnet.solana.com/",
    recipientPublicKey: "",
    demoAmountLamports: 1_000_000,
    paymentLabel: "Call-to-Cash Demo",
    commitment: "confirmed",
    ready: false
  },
  voiceProvider: "replay",
  agora: {
    appId: "",
    appCertificate: "",
    customerId: "",
    customerSecret: "",
    providerEventSecret: "",
    ncsWebhookSecret: "",
    agentProperties: {},
    tokenTtlSeconds: 600,
    agentUid: 9001,
    agentName: "call-to-cash-agent",
    baseUrl: "https://api.agora.io/",
    liveRelay: {
      url: "http://127.0.0.1:3011/",
      controlSecret: "",
      uid: 9002,
      ready: false
    },
    ready: false
  },
  aiProvider: "deterministic",
  aiExtraction: {
    mode: "hybrid",
    model: "gpt-5-mini",
    apiKey: "",
    timeoutMs: 1_500,
    promptVersion: "CTC-BOOKING-EXTRACTION-V1"
  },
  logLevel: "silent" as const,
  rateLimitMax: 0
} as const;

const solanaRecipient = encodeBase58(new Uint8Array(32).fill(21));
const solanaConfig = {
  ...demoConfig,
  paymentProvider: "solana_devnet",
  solanaDevnet: {
    ...demoConfig.solanaDevnet,
    recipientPublicKey: solanaRecipient,
    ready: true
  }
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

async function seedFutureDeparture(resetDatabase = true) {
  assert.ok(databaseUrl);
  const prisma = createPrismaClient({ databaseUrl });
  const suffix = uniqueSuffix();

  if (resetDatabase) {
    await prisma.$transaction([
      prisma.revenueTwinOffer.deleteMany(),
      prisma.revenueTwinWaitlistEntry.deleteMany(),
      prisma.revenueTwinEvaluation.deleteMany(),
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
  }
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

async function createReplayBooking(app: ReturnType<typeof buildApp>, resetDatabase = true) {
  await seedFutureDeparture(resetDatabase);

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
  assert.equal(turnResponse.statusCode, 202, turnResponse.body);

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

async function confirmReplayBooking(app: ReturnType<typeof buildApp>, resetDatabase = true) {
  const replay = await createReplayBooking(app, resetDatabase);
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

async function seedRevenueTwinOverflow() {
  assert.ok(databaseUrl);
  const prisma = createPrismaClient({ databaseUrl });
  const suffix = uniqueSuffix();
  const now = new Date("2030-06-20T15:00:00.000Z");
  const primary = await prisma.tripDeparture.create({
    data: {
      publicId: `dep_rtw_primary_${suffix}`,
      routeCode: `RTW-${suffix}`,
      routeFrom: "Da Nang",
      routeTo: "Ba Na",
      departureAtUtc: now,
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 2,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 200_000,
      depositAmountMinor: 30_000,
      pricePolicyVersion: "RTW-PRICE-V1",
      refundPolicyVersion: "RTW-REFUND-V1"
    }
  });
  const alternative = await prisma.tripDeparture.create({
    data: {
      publicId: `dep_rtw_alternative_${suffix}`,
      routeCode: primary.routeCode,
      routeFrom: "Da Nang",
      routeTo: "Ba Na",
      departureAtUtc: new Date(now.getTime() + 30 * 60_000),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 20,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 200_000,
      depositAmountMinor: 30_000,
      pricePolicyVersion: "RTW-PRICE-V1",
      refundPolicyVersion: "RTW-REFUND-V1"
    }
  });
  const call = await prisma.callSession.create({
    data: {
      publicId: `call_rtw_${suffix}`,
      channelName: `ctc_rtw_${suffix}`,
      sourceMode: "DEMO",
      status: "ACTIVE"
    }
  });
  const booking = await prisma.booking.create({
    data: {
      publicId: `bk_rtw_${suffix}`,
      callSessionId: call.id,
      tripDepartureId: primary.id,
      status: "AGREEMENT_READY",
      routeFrom: "Da Nang",
      routeTo: "Ba Na",
      departureAtUtc: primary.departureAtUtc,
      passengerCount: 1,
      totalAmountMinor: 200_000,
      depositAmountMinor: 30_000,
      refundPolicyVersion: "RTW-REFUND-V1"
    }
  });
  await prisma.callSession.update({ where: { id: call.id }, data: { bookingId: booking.id } });
  const occupiedBooking = await prisma.booking.create({
    data: {
      publicId: `bk_rtw_occupied_${suffix}`,
      tripDepartureId: primary.id,
      status: "AGREEMENT_LOCKED",
      passengerCount: 2,
      routeFrom: "Da Nang",
      routeTo: "Ba Na",
      departureAtUtc: primary.departureAtUtc,
      totalAmountMinor: 400_000,
      depositAmountMinor: 60_000,
      refundPolicyVersion: "RTW-REFUND-V1"
    }
  });
  await prisma.inventoryHold.create({
    data: {
      publicId: `hold_rtw_${suffix}`,
      idempotencyKey: `hold-rtw-${suffix}`,
      bookingId: occupiedBooking.id,
      departureId: primary.id,
      quantity: 2,
      status: "ACTIVE",
      expiresAt: new Date(now.getTime() + 60 * 60_000)
    }
  });
  await prisma.$disconnect();
  return {
    callId: call.publicId,
    primaryDepartureId: primary.publicId,
    alternativeDepartureId: alternative.publicId
  };
}

async function createRevenueTwinCompetingCall(primaryDepartureId: string) {
  assert.ok(databaseUrl);
  const prisma = createPrismaClient({ databaseUrl });
  const primary = await prisma.tripDeparture.findUniqueOrThrow({
    where: { publicId: primaryDepartureId }
  });
  const suffix = uniqueSuffix();
  const call = await prisma.callSession.create({
    data: {
      publicId: `call_rtw_competing_${suffix}`,
      channelName: `ctc_rtw_competing_${suffix}`,
      sourceMode: "DEMO",
      status: "ACTIVE"
    }
  });
  const booking = await prisma.booking.create({
    data: {
      publicId: `bk_rtw_competing_${suffix}`,
      callSessionId: call.id,
      tripDepartureId: primary.id,
      status: "AGREEMENT_READY",
      routeFrom: primary.routeFrom,
      routeTo: primary.routeTo,
      departureAtUtc: primary.departureAtUtc,
      passengerCount: 1,
      totalAmountMinor: primary.farePerSeatMinor,
      depositAmountMinor: primary.depositAmountMinor,
      refundPolicyVersion: primary.refundPolicyVersion
    }
  });
  await prisma.callSession.update({ where: { id: call.id }, data: { bookingId: booking.id } });
  await prisma.$disconnect();
  return call.publicId;
}

test(
  "Phase 10 persists safe deterministic fallback provenance without changing booking authority",
  { skip: phase5SkipReason() },
  async () => {
    assert.ok(databaseUrl);
    const app = buildApp({ ...demoConfig, aiProvider: "openai" });
    const { callId, bookingId } = await createReplayBooking(app);
    const prisma = createPrismaClient({ databaseUrl });
    const extraction = await prisma.bookingExtraction.findFirst({
      where: { callSession: { publicId: callId } },
      orderBy: { createdAt: "desc" }
    });

    assert.ok(extraction);
    assert.equal(extraction.extractionVersion, "ctc-booking-extraction-v1:deterministic");
    assert.equal((extraction.payload as { fallbackUsed?: boolean }).fallbackUsed, true);
    assert.equal(JSON.stringify(extraction.payload).includes("0912345678"), false);

    const riskResponse = await app.inject({ method: "GET", url: `/v1/calls/${callId}/risk` });
    assert.equal(riskResponse.statusCode, 200);
    assert.equal(riskResponse.json().data.bookingId, bookingId);
    assert.notEqual(riskResponse.json().data.paymentGate, PaymentGateStatus.Unlocked);

    await prisma.$disconnect();
    await app.close();
  }
);

test(
  "Phase 10 accepts an injected strict-schema candidate only through the existing booking path",
  { skip: phase5SkipReason() },
  async () => {
    assert.ok(databaseUrl);
    const app = buildApp(demoConfig, {
      bookingExtractor: {
        name: "fake-llm",
        async extract(input) {
          return {
            outcome: "SUCCESS" as const,
            provider: "fake-llm",
            fallbackUsed: false,
            candidate: {
              schemaVersion: "ctc.booking-extraction.v1" as const,
              fields: {
                origin: {
                  value: "Ha Noi",
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                },
                destination: {
                  value: "Sa Pa",
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                },
                departureTime: {
                  value: "22:30",
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                },
                passengerCount: {
                  value: 3,
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                },
                pickupPoint: {
                  value: "My Dinh",
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                },
                contactPhoneCandidate: {
                  value: "0912***678",
                  confidence: 0.9,
                  status: "PRESENT" as const,
                  evidenceRefs: [{ turnId: input.sourceTurnId }]
                }
              },
              warnings: []
            }
          };
        }
      }
    });
    const { callId } = await createReplayBooking(app);
    const prisma = createPrismaClient({ databaseUrl });
    const extraction = await prisma.bookingExtraction.findFirst({
      where: { callSession: { publicId: callId } }
    });

    assert.equal((extraction?.payload as { provider?: string }).provider, "fake-llm");
    assert.equal((extraction?.payload as { fallbackUsed?: boolean }).fallbackUsed, false);
    await prisma.$disconnect();
    await app.close();
  }
);

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

test("Revenue Twin routes reject mismatched identifiers with the documented safe error envelope", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({
    method: "POST",
    url: "/v1/calls/call_01JTEST0001/revenue-twin/offers/rtw_offer_01JTEST0001/accept",
    headers: { "Idempotency-Key": "revenue-twin-accept-001" },
    payload: {
      callId: "call_01JTEST0001",
      evaluationId: "rtw_eval_01JTEST0001",
      offerId: "rtw_offer_01JTEST9999",
      idempotencyKey: "revenue-twin-accept-001"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().success, false);
  assert.equal(response.json().error.code, ErrorCodeSchema.enum.VALIDATION_ERROR);
  await app.close();
});

test(
  "Revenue Twin evaluates overflow, accepts an offer once, and replays its canonical hold",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const fixture = await seedRevenueTwinOverflow();
    const app = buildApp(demoConfig);

    const evaluationResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations`
    });
    assert.equal(evaluationResponse.statusCode, 201, evaluationResponse.body);
    const evaluation = evaluationResponse.json().data.evaluation;
    assert.equal(evaluation.status, "OVERFLOW_OFFERS_AVAILABLE");
    assert.equal(evaluation.offers.length, 1);
    assert.equal(evaluation.offers[0].alternativeDepartureId, fixture.alternativeDepartureId);

    const offer = evaluation.offers[0];
    const body = {
      callId: fixture.callId,
      evaluationId: evaluation.evaluationId,
      offerId: offer.offerId,
      idempotencyKey: `rtw-accept-${uniqueSuffix()}`
    };
    const acceptResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/offers/${offer.offerId}/accept`,
      headers: { "Idempotency-Key": body.idempotencyKey },
      payload: body
    });
    assert.equal(acceptResponse.statusCode, 200, acceptResponse.body);
    const accepted = acceptResponse.json().data;
    assert.equal(accepted.status, "ACCEPTED");
    assert.match(accepted.inventoryHoldId, /^hold_/u);

    const replayResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/offers/${offer.offerId}/accept`,
      headers: { "Idempotency-Key": body.idempotencyKey },
      payload: body
    });
    assert.equal(replayResponse.statusCode, 200, replayResponse.body);
    assert.deepEqual(replayResponse.json().data, accepted);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/v1/revenue-twin/dashboard"
    });
    assert.equal(dashboardResponse.statusCode, 200, dashboardResponse.body);
    const dashboard = dashboardResponse.json().data;
    assert.equal(dashboard.metrics.offersAccepted, 1);
    assert.equal(dashboard.metrics.securedRecoveredRevenueAmountMinor, 0);
    assert.equal(dashboard.metrics.reevaluations, 0);
    assert.equal(dashboard.metrics.lostDemandReductionBasisPoints, 10_000);
    assert.equal(dashboard.occupancy.beforeOccupiedSeats, 0);
    assert.equal(dashboard.occupancy.afterOccupiedSeats, 1);
    assert.equal(dashboard.timeline[0].kind, "ACCEPTED");
    assert.equal(dashboard.routing[0].offerId, offer.offerId);
    assert.equal(JSON.stringify(dashboard).includes("0912345678"), false);
    await app.close();
  }
);

test(
  "a final customer voice selection accepts only the stored Revenue Twin offer",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const fixture = await seedRevenueTwinOverflow();
    const app = buildApp(demoConfig);
    const evaluationResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations`
    });
    assert.equal(evaluationResponse.statusCode, 201, evaluationResponse.body);
    const offer = evaluationResponse.json().data.evaluation.offers[0];
    const selectionResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/transcript-turns`,
      payload: {
        turn: {
          clientTurnId: `voice-selection-${uniqueSuffix()}`,
          sequenceNo: 1,
          speaker: "CUSTOMER",
          content: "Chốt chuyến đầu tiên.",
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      }
    });
    assert.equal(selectionResponse.statusCode, 202, selectionResponse.body);
    const latestResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations/latest`
    });
    assert.equal(latestResponse.statusCode, 200, latestResponse.body);
    assert.equal(latestResponse.json().data.offers[0].offerId, offer.offerId);
    assert.equal(latestResponse.json().data.offers[0].status, "ACCEPTED");
    assert.equal(latestResponse.json().data.directive.action, "CONFIRM_SELECTED_OFFER");
    await app.close();
  }
);

test(
  "two Revenue Twin acceptances competing for the final alternative seat cannot oversell",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const fixture = await seedRevenueTwinOverflow();
    const prisma = createPrismaClient({ databaseUrl: databaseUrl! });
    await prisma.tripDeparture.update({
      where: { publicId: fixture.alternativeDepartureId },
      data: { capacity: 1 }
    });
    await prisma.$disconnect();
    const competingCallId = await createRevenueTwinCompetingCall(fixture.primaryDepartureId);
    const app = buildApp(demoConfig);
    const firstEvaluation = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations`
    });
    const secondEvaluation = await app.inject({
      method: "POST",
      url: `/v1/calls/${competingCallId}/revenue-twin/evaluations`
    });
    const first = firstEvaluation.json().data.evaluation;
    const second = secondEvaluation.json().data.evaluation;
    const accept = (
      callId: string,
      evaluation: { evaluationId: string; offers: Array<{ offerId: string }> }
    ) => {
      const offerId = evaluation.offers[0]!.offerId;
      const payload = {
        callId,
        evaluationId: evaluation.evaluationId,
        offerId,
        idempotencyKey: `last-seat-${uniqueSuffix()}`
      };
      return app.inject({
        method: "POST",
        url: `/v1/calls/${callId}/revenue-twin/offers/${offerId}/accept`,
        headers: { "Idempotency-Key": payload.idempotencyKey },
        payload
      });
    };
    const responses = await Promise.all([
      accept(fixture.callId, first),
      accept(competingCallId, second)
    ]);
    assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
    const verify = createPrismaClient({ databaseUrl: databaseUrl! });
    assert.equal(
      await verify.inventoryHold.count({
        where: { departure: { publicId: fixture.alternativeDepartureId }, status: "ACTIVE" }
      }),
      1
    );
    await verify.$disconnect();
    await app.close();
  }
);

test(
  "Revenue Twin proactively protects scarce primary capacity but moves nobody without consent",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const fixture = await seedRevenueTwinOverflow();
    const prisma = createPrismaClient({ databaseUrl: databaseUrl! });
    await prisma.tripDeparture.update({
      where: { publicId: fixture.primaryDepartureId },
      data: { capacity: 4 }
    });
    const booking = await prisma.booking.findFirstOrThrow({
      where: { callSession: { publicId: fixture.callId } }
    });
    await prisma.inventoryHold.create({
      data: {
        publicId: `hold_rtw_customer_${uniqueSuffix()}`,
        idempotencyKey: `hold-rtw-customer-${uniqueSuffix()}`,
        bookingId: booking.id,
        departureId: booking.tripDepartureId!,
        quantity: 1,
        status: "ACTIVE",
        expiresAt: new Date("2030-06-20T16:00:00.000Z")
      }
    });
    await prisma.$disconnect();
    const app = buildApp(demoConfig);

    const evaluationResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations`
    });
    assert.equal(evaluationResponse.statusCode, 201, evaluationResponse.body);
    const evaluation = evaluationResponse.json().data.evaluation;
    assert.equal(evaluation.status, "PROACTIVE_OFFERS_AVAILABLE");
    assert.equal(evaluation.offers.length, 1);
    assert.equal(evaluation.offers[0].reasonCodes.includes("PRIMARY_CAPACITY_SCARCE"), true);
    assert.equal(evaluation.offers[0].reasonCodes.includes("ALTERNATIVE_CAPACITY_SURPLUS"), true);
    const latestResponse = await app.inject({
      method: "GET",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations/latest`
    });
    assert.equal(latestResponse.statusCode, 200, latestResponse.body);
    assert.equal(latestResponse.json().data.directive.action, "PRESENT_OVERFLOW_OFFERS");

    const beforeConsent = createPrismaClient({ databaseUrl: databaseUrl! });
    assert.equal(
      await beforeConsent.inventoryHold.count({
        where: { departure: { publicId: fixture.alternativeDepartureId }, status: "ACTIVE" }
      }),
      0
    );
    const bookingBeforeConsent = await beforeConsent.booking.findFirstOrThrow({
      where: { callSession: { publicId: fixture.callId } },
      include: { tripDeparture: true }
    });
    assert.equal(bookingBeforeConsent.tripDeparture?.publicId, fixture.primaryDepartureId);
    await beforeConsent.$disconnect();

    const offer = evaluation.offers[0];
    const idempotencyKey = `proactive-accept-${uniqueSuffix()}`;
    const acceptance = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/offers/${offer.offerId}/accept`,
      headers: { "Idempotency-Key": idempotencyKey },
      payload: {
        callId: fixture.callId,
        evaluationId: evaluation.evaluationId,
        offerId: offer.offerId,
        idempotencyKey
      }
    });
    assert.equal(acceptance.statusCode, 200, acceptance.body);
    const afterAcceptance = createPrismaClient({ databaseUrl: databaseUrl! });
    assert.equal(
      await afterAcceptance.inventoryHold.count({
        where: {
          bookingId: booking.id,
          departure: { publicId: fixture.primaryDepartureId },
          status: "ACTIVE"
        }
      }),
      0
    );
    assert.equal(
      await afterAcceptance.inventoryHold.count({
        where: {
          bookingId: booking.id,
          departure: { publicId: fixture.alternativeDepartureId },
          status: "ACTIVE"
        }
      }),
      1
    );
    const bookingAfterAcceptance = await afterAcceptance.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { tripDeparture: true }
    });
    assert.equal(bookingAfterAcceptance.tripDeparture?.publicId, fixture.alternativeDepartureId);
    await afterAcceptance.$disconnect();
    await app.close();
  }
);

test(
  "an explicit final customer waitlist request persists without creating an inventory hold",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const fixture = await seedRevenueTwinOverflow();
    const prisma = createPrismaClient({ databaseUrl: databaseUrl! });
    await prisma.tripDeparture.update({
      where: { publicId: fixture.alternativeDepartureId },
      data: { operationalStatus: "CANCELLED" }
    });
    await prisma.$disconnect();
    const app = buildApp(demoConfig);
    const evaluationResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/revenue-twin/evaluations`
    });
    const evaluation = evaluationResponse.json().data.evaluation;
    assert.equal(evaluation.status, "GROUP_CAPACITY_UNAVAILABLE");
    const response = await app.inject({
      method: "POST",
      url: `/v1/calls/${fixture.callId}/transcript-turns`,
      payload: {
        turn: {
          clientTurnId: `waitlist-${uniqueSuffix()}`,
          sequenceNo: 1,
          speaker: "CUSTOMER",
          content: "Cho tôi vào danh sách chờ.",
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      }
    });
    assert.equal(response.statusCode, 202, response.body);
    const verify = createPrismaClient({ databaseUrl: databaseUrl! });
    assert.equal(
      await verify.revenueTwinWaitlistEntry.count({
        where: { callSession: { publicId: fixture.callId }, status: "PENDING" }
      }),
      1
    );
    assert.equal(
      await verify.inventoryHold.count({
        where: { departure: { publicId: fixture.alternativeDepartureId }, status: "ACTIVE" }
      }),
      0
    );
    assert.equal(
      await verify.auditLog.count({
        where: {
          aggregateType: "CALL_STREAM",
          aggregateId: fixture.callId,
          action: "EVENT_REVENUE_TWIN_WAITLIST_JOINED"
        }
      }),
      1
    );
    await verify.$disconnect();
    await app.close();
  }
);

test("GET / returns a safe API discovery envelope", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "GET", url: "/" });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(ApiSuccessEnvelopeSchema.safeParse(payload).success, true);
  assert.deepEqual(payload.data, {
    service: "call-to-cash-api",
    health: "/health",
    readiness: "/ready"
  });

  await app.close();
});

test("GET /ready fails safely when the selected Solana provider is not configured", async () => {
  const databaseClient = {
    $queryRaw: async () => [{ ready: 1 }]
  } as unknown as DatabaseClient;
  const app = buildApp({ ...demoConfig, paymentProvider: "solana_devnet" }, { databaseClient });
  const response = await app.inject({ method: "GET", url: "/ready" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, ErrorCodeSchema.enum.SOLANA_RPC_UNAVAILABLE);
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
        EventName.BookingCreated,
        EventName.BookingUpdated,
        EventName.RiskScoreUpdated,
        EventName.RiskPaymentGateUpdated,
        EventName.TranscriptAnalysisUpdated,
        EventName.RevenueTwinEvaluated
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
        EventName.BookingCreated,
        EventName.BookingUpdated,
        EventName.RiskScoreUpdated,
        EventName.RiskPaymentGateUpdated,
        EventName.TranscriptAnalysisUpdated,
        EventName.RevenueTwinEvaluated
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
  "a final agent turn is persisted without changing the customer booking",
  { skip: phase5SkipReason() },
  async () => {
    const app = buildApp(demoConfig);
    const { callId, bookingId } = await createReplayBooking(app);
    const before = await app.inject({ method: "GET", url: `/v1/bookings/${bookingId}` });
    assert.equal(before.statusCode, 200);

    const agentTurn = await app.inject({
      method: "POST",
      url: `/v1/calls/${callId}/transcript-turns`,
      payload: {
        turn: {
          clientTurnId: `agent-turn-${uniqueSuffix()}`,
          sequenceNo: 2,
          speaker: "AGENT",
          content: "Tôi đã đổi thành 9 vé Huế đi Cần Thơ.",
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      }
    });
    assert.equal(agentTurn.statusCode, 202);

    const after = await app.inject({ method: "GET", url: `/v1/bookings/${bookingId}` });
    assert.equal(after.statusCode, 200);
    assert.deepEqual(after.json().data, before.json().data);

    const transcript = await app.inject({ method: "GET", url: `/v1/calls/${callId}/transcript` });
    assert.equal(transcript.statusCode, 200);
    assert.equal(transcript.json().data.turns.at(-1).speaker, "AGENT");
    await app.close();
  }
);

test(
  "adding passenger count after a selected departure recalculates the fare total",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const app = buildApp(demoConfig);
    const callResponse = await app.inject({
      method: "POST",
      url: "/v1/calls",
      payload: { channelPurpose: "BOOKING", sourceMode: "TRANSCRIPT_REPLAY" }
    });
    const callId = callResponse.json().data.callId as string;

    for (const [sequenceNo, content] of [
      [1, "Tôi muốn đi Hà Nội Sa Pa chuyến 22:30"],
      [2, "3 khách"]
    ] as const) {
      const turn = await app.inject({
        method: "POST",
        url: `/v1/calls/${callId}/transcript-turns`,
        payload: {
          turn: {
            clientTurnId: `pricing-turn-${sequenceNo}-${uniqueSuffix()}`,
            sequenceNo,
            speaker: "CUSTOMER",
            content,
            language: "vi-VN",
            isFinal: true,
            source: "REPLAY"
          }
        }
      });
      assert.equal(turn.statusCode, 202);
    }

    const call = await app.inject({ method: "GET", url: `/v1/calls/${callId}` });
    const booking = await app.inject({
      method: "GET",
      url: `/v1/bookings/${call.json().data.booking.bookingId}`
    });
    assert.equal(booking.statusCode, 200);
    assert.equal(booking.json().data.fareTotalVnd, 900_000);
    await app.close();
  }
);

test(
  "Phase 10.5 imported schedule rows drive authoritative summary, pricing, hold, and payment guard",
  { skip: phase5SkipReason() },
  async () => {
    assert.ok(databaseUrl);
    await seedFutureDeparture();
    const prisma = createPrismaClient({ databaseUrl });
    await prisma.tripDeparture.create({
      data: {
        publicId: `dep_phase105_cantho_dalat_${uniqueSuffix()}`,
        routeCode: `CTO-DLI-PHASE105-${uniqueSuffix()}`,
        routeFrom: "Can Tho",
        routeTo: "Da Lat",
        departureAtUtc: new Date("2030-05-25T00:30:00.000Z"),
        departureTimezone: "Asia/Ho_Chi_Minh",
        capacity: 36,
        operationalStatus: "SCHEDULED",
        currency: "VND",
        farePerSeatMinor: 420_000,
        depositAmountMinor: 300_000,
        pricePolicyVersion: "BUS-PRICE-V1",
        refundPolicyVersion: "BUS-V1/1.0"
      }
    });
    await prisma.$disconnect();

    const app = buildApp(demoConfig);
    const callResponse = await app.inject({
      method: "POST",
      url: "/v1/calls",
      payload: { channelPurpose: "BOOKING", sourceMode: "TRANSCRIPT_REPLAY" }
    });
    assert.equal(callResponse.statusCode, 201, callResponse.body);
    const callId = callResponse.json().data.callId as string;
    const turnResponse = await app.inject({
      method: "POST",
      url: `/v1/calls/${callId}/transcript-turns`,
      payload: {
        turn: {
          clientTurnId: `phase105-turn-${uniqueSuffix()}`,
          sequenceNo: 1,
          speaker: "CUSTOMER",
          content:
            "Em dat 2 ve di Da Lat tu Can Tho ngay 25/5 luc 07:30, don o ben xe Can Tho, lien he 0912345678.",
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      }
    });
    assert.equal(turnResponse.statusCode, 202, turnResponse.body);

    const callRead = await app.inject({ method: "GET", url: `/v1/calls/${callId}` });
    assert.equal(callRead.statusCode, 200, callRead.body);
    const bookingId = callRead.json().data.booking.bookingId as string;
    const bookingResponse = await app.inject({
      method: "GET",
      url: `/v1/bookings/${bookingId}`
    });
    assert.equal(bookingResponse.statusCode, 200, bookingResponse.body);
    const booking = bookingResponse.json().data;
    assert.equal(booking.routeFrom, "Can Tho");
    assert.equal(booking.routeTo, "Da Lat");
    assert.equal(booking.passengerCount, 2);
    assert.equal(booking.pickupPoint, "Ben xe Can Tho");
    assert.equal(booking.contactPhoneMasked, "0912***678");
    assert.equal(booking.fareTotalVnd, 840_000);
    assert.equal(booking.depositAmountVnd, 300_000);
    assert.equal(booking.status, "AGREEMENT_READY");

    const verify = createPrismaClient({ databaseUrl });
    const persisted = await verify.booking.findUniqueOrThrow({
      where: { publicId: bookingId },
      include: { inventoryHolds: true, tripDeparture: true }
    });
    assert.equal(persisted.tripDeparture?.routeCode.startsWith("CTO-DLI-PHASE105-"), true);
    assert.equal(persisted.inventoryHolds.length, 1);
    assert.equal(persisted.inventoryHolds[0]?.quantity, 2);
    assert.equal(persisted.inventoryHolds[0]?.status, "ACTIVE");
    await verify.$disconnect();

    const prematurePayment = await app.inject({
      method: "POST",
      url: "/v1/payments/mock/create",
      headers: { "Idempotency-Key": `phase105-payment-${uniqueSuffix()}` },
      payload: { bookingId }
    });
    assert.equal(prematurePayment.statusCode, 422, prematurePayment.body);
    assert.equal(prematurePayment.json().success, false);
    assert.equal(prematurePayment.json().error.code, ErrorCodeSchema.enum.AGREEMENT_NOT_READY);

    await app.close();
  }
);

test(
  "a selected route and departure are available before passenger count arrives",
  { skip: phase5SkipReason() },
  async () => {
    await seedFutureDeparture();
    const app = buildApp(demoConfig);
    const callResponse = await app.inject({
      method: "POST",
      url: "/v1/calls",
      payload: { channelPurpose: "BOOKING", sourceMode: "TRANSCRIPT_REPLAY" }
    });
    const callId = callResponse.json().data.callId as string;
    const turn = await app.inject({
      method: "POST",
      url: `/v1/calls/${callId}/transcript-turns`,
      payload: {
        turn: {
          clientTurnId: `route-first-${uniqueSuffix()}`,
          sequenceNo: 1,
          speaker: "CUSTOMER",
          content: "Ha Noi Sapa, hai muoi hai:ba muoi phut.",
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        }
      }
    });
    assert.equal(turn.statusCode, 202);

    const call = await app.inject({ method: "GET", url: `/v1/calls/${callId}` });
    const booking = await app.inject({
      method: "GET",
      url: `/v1/bookings/${call.json().data.booking.bookingId}`
    });
    assert.equal(booking.statusCode, 200);
    assert.equal(booking.json().data.routeFrom, "Ha Noi");
    assert.equal(booking.json().data.routeTo, "Sa Pa");
    assert.notEqual(booking.json().data.departureAt, null);
    assert.equal(booking.json().data.fareTotalVnd, null);
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
        headers: { Accept: "text/event-stream", Origin: "http://localhost:5174" },
        signal: controller.signal
      });
      assert.equal(eventResponse.status, 200);
      assert.equal(
        eventResponse.headers.get("access-control-allow-origin"),
        "http://localhost:5174"
      );
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

    assert.deepEqual(agreementAfter.canonicalPayload, agreementBefore.canonicalPayload);
    assert.equal(agreementAfter.payloadHashSha256, agreementBefore.payloadHashSha256);
    const receiptVerificationEvent = await prismaAfter.auditLog.findFirstOrThrow({
      where: {
        aggregateType: "CALL_STREAM",
        action: "EVENT_RECEIPT_VERIFIED",
        metadata: { path: ["event"], equals: EventName.ReceiptVerified }
      },
      orderBy: { createdAt: "desc" }
    });
    assert.equal(
      (receiptVerificationEvent.afterState as { event: string }).event,
      EventName.ReceiptVerified
    );
    const bookingAfterTamper = await prismaAfter.booking.findUniqueOrThrow({
      where: { publicId: happyBookingId },
      select: { status: true }
    });
    assert.equal(bookingAfterTamper.status, "MANUAL_REVIEW_REQUIRED");
    await prismaAfter.$disconnect();

    await app.close();
    await happyApp.close();
  }
);

test(
  "Phase 8 generic payment routes verify Devnet RPC evidence before proof and receipt creation",
  { skip: phase5SkipReason() },
  async () => {
    assert.ok(databaseUrl);
    let expectedReference = "";
    let confirmationStatus: "processed" | "confirmed" = "processed";
    const transactionSignature = encodeBase58(new Uint8Array(64).fill(22));
    const rpcClient: SolanaRpcClient = {
      async getSignaturesForAddress(value) {
        assert.equal(value, expectedReference);
        return [{ signature: transactionSignature, confirmationStatus, err: null }];
      },
      async getSignatureStatus() {
        return { confirmationStatus, err: null };
      },
      async getTransaction(): Promise<SolanaParsedTransaction> {
        return {
          slot: 999,
          blockTime: 1_782_000_000,
          meta: { err: null, innerInstructions: [] },
          transaction: {
            message: {
              accountKeys: [
                { pubkey: encodeBase58(new Uint8Array(32).fill(23)) },
                { pubkey: solanaRecipient },
                { pubkey: expectedReference }
              ],
              instructions: [
                {
                  program: "system",
                  parsed: {
                    type: "transfer",
                    info: {
                      source: encodeBase58(new Uint8Array(32).fill(23)),
                      destination: solanaRecipient,
                      lamports: 1_000_000
                    }
                  }
                }
              ]
            },
            signatures: [transactionSignature]
          }
        };
      }
    };
    const paymentProvider = new SolanaDevnetPaymentProvider({
      rpcUrl: solanaConfig.solanaDevnet.rpcUrl,
      recipientPublicKey: solanaRecipient,
      amountLamports: solanaConfig.solanaDevnet.demoAmountLamports,
      label: solanaConfig.solanaDevnet.paymentLabel,
      commitment: solanaConfig.solanaDevnet.commitment,
      rpcClient
    });
    const app = buildApp(solanaConfig, { paymentProvider });
    const { bookingId } = await confirmReplayBooking(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "Idempotency-Key": `solana-payment-${uniqueSuffix()}` },
      payload: { bookingId }
    });
    assert.equal(createResponse.statusCode, 201, JSON.stringify(createResponse.json()));
    const payment = createResponse.json().data;
    expectedReference = payment.reference;
    assert.equal(payment.provider, "solana_devnet");
    assert.equal(payment.providerPayment.cluster, "devnet");
    assert.equal(payment.providerPayment.amountLamports, 1_000_000);
    assert.match(payment.providerPayment.solanaPayUrl, /^solana:/u);

    const pendingResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/verify",
      headers: { "Idempotency-Key": `solana-pending-${uniqueSuffix()}` },
      payload: {
        paymentIntentId: payment.paymentIntentId
      }
    });
    assert.equal(pendingResponse.statusCode, 202, JSON.stringify(pendingResponse.json()));
    assert.equal(
      pendingResponse.json().error.code,
      ErrorCodeSchema.enum.PAYMENT_TRANSACTION_UNCONFIRMED
    );
    const pendingPrisma = createPrismaClient({ databaseUrl });
    assert.equal(
      await pendingPrisma.proofRecord.count({
        where: { booking: { publicId: bookingId } }
      }),
      0
    );
    assert.equal(
      await pendingPrisma.trustReceipt.count({ where: { booking: { publicId: bookingId } } }),
      0
    );
    await pendingPrisma.$disconnect();
    confirmationStatus = "confirmed";

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/verify",
      headers: { "Idempotency-Key": `solana-verify-${uniqueSuffix()}` },
      payload: {
        paymentIntentId: payment.paymentIntentId
      }
    });
    assert.equal(verifyResponse.statusCode, 200, JSON.stringify(verifyResponse.json()));
    assert.equal(verifyResponse.json().data.status, "CONFIRMED");

    const prisma = createPrismaClient({ databaseUrl });
    const transaction = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { txSignature: transactionSignature }
    });
    assert.equal(transaction.chain, "SOLANA_DEVNET");
    assert.equal(transaction.observedAmountMinor, 1_000_000);
    assert.equal(transaction.observedRecipientWallet, solanaRecipient);
    assert.equal(transaction.observedReference, expectedReference);
    assert.equal(transaction.slot, 999n);
    const serializedMetadata = JSON.stringify(transaction.rawChainMetadata);
    assert.match(serializedMetadata, /"cluster":"devnet"/u);
    assert.doesNotMatch(serializedMetadata, /0912345678|transcript|canonicalPayload/iu);
    assert.equal(
      await prisma.proofRecord.count({ where: { paymentTransactionId: transaction.id } }),
      1
    );
    assert.equal(
      await prisma.trustReceipt.count({
        where: { paymentIntent: { publicId: payment.paymentIntentId } }
      }),
      1
    );

    const secondBooking = await confirmReplayBooking(app, false);
    const secondCreateResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "Idempotency-Key": `solana-payment-reuse-${uniqueSuffix()}` },
      payload: { bookingId: secondBooking.bookingId }
    });
    assert.equal(secondCreateResponse.statusCode, 201, JSON.stringify(secondCreateResponse.json()));
    const secondPayment = secondCreateResponse.json().data;
    expectedReference = secondPayment.reference;

    const reusedResponse = await app.inject({
      method: "POST",
      url: "/v1/payments/verify",
      headers: { "Idempotency-Key": `solana-verify-reuse-${uniqueSuffix()}` },
      payload: { paymentIntentId: secondPayment.paymentIntentId }
    });
    assert.equal(reusedResponse.statusCode, 409, JSON.stringify(reusedResponse.json()));
    assert.equal(reusedResponse.json().error.code, ErrorCodeSchema.enum.PAYMENT_TRANSACTION_REUSED);
    assert.equal(
      await prisma.trustReceipt.count({
        where: { paymentIntent: { publicId: secondPayment.paymentIntentId } }
      }),
      0
    );
    await prisma.$disconnect();
    await app.close();
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

test("native Agora mode does not expose a custom LLM gateway route", async () => {
  const app = buildApp(demoConfig);
  const response = await app.inject({ method: "POST", url: "/v1/agora/chat/completions" });

  assert.equal(response.statusCode, 404);
  await app.close();
});
