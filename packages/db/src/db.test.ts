import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import {
  IdempotencyConflictError,
  InventoryRepository,
  InventoryUnavailableError,
  ReceiptTraceRepository,
  createPrismaClient
} from "./index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const prisma = databaseUrl === undefined ? undefined : createPrismaClient({ databaseUrl });

after(async () => {
  await prisma?.$disconnect();
});

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

async function createBookingFixture(capacity: number) {
  assert.ok(prisma);

  const departure = await prisma.tripDeparture.create({
    data: {
      publicId: opaqueId("dep"),
      routeCode: opaqueId("HN_SAPA"),
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: new Date("2030-06-20T15:30:00.000Z"),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 300_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    }
  });
  const call = await prisma.callSession.create({
    data: {
      publicId: opaqueId("call"),
      status: "ACTIVE",
      channelName: opaqueId("ctc_call"),
      purpose: "BOOKING",
      sourceMode: "DEMO",
      analysisEnabled: true
    }
  });
  const booking = await prisma.booking.create({
    data: {
      publicId: opaqueId("bk"),
      callSessionId: call.id,
      tripDepartureId: departure.id,
      status: "BOOKING_DRAFT_READY",
      routeFrom: departure.routeFrom,
      routeTo: departure.routeTo,
      departureAtUtc: departure.departureAtUtc,
      departureTimezone: departure.departureTimezone,
      passengerCount: 1,
      currency: "VND",
      totalAmountMinor: 300_000,
      depositAmountMinor: 300_000,
      refundPolicyVersion: departure.refundPolicyVersion
    }
  });
  await prisma.callSession.update({
    where: { id: call.id },
    data: { bookingId: booking.id }
  });

  return { booking, call, departure };
}

test(
  "concurrent inventory reservations cannot oversell a departure",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const first = await createBookingFixture(3);
    const second = await prisma.booking.create({
      data: {
        publicId: opaqueId("bk"),
        tripDepartureId: first.departure.id,
        status: "BOOKING_DRAFT_READY",
        routeFrom: first.departure.routeFrom,
        routeTo: first.departure.routeTo,
        departureAtUtc: first.departure.departureAtUtc,
        departureTimezone: first.departure.departureTimezone,
        passengerCount: 2,
        currency: "VND",
        totalAmountMinor: 600_000,
        depositAmountMinor: 300_000,
        refundPolicyVersion: first.departure.refundPolicyVersion
      }
    });
    const inventory = new InventoryRepository(prisma);
    const now = new Date("2030-06-20T14:00:00.000Z");
    const expiresAt = new Date("2030-06-20T14:15:00.000Z");

    const results = await Promise.allSettled([
      inventory.reserve({
        publicId: opaqueId("hold"),
        idempotencyKey: opaqueId("idem"),
        bookingId: first.booking.id,
        departureId: first.departure.id,
        quantity: 2,
        now,
        expiresAt
      }),
      inventory.reserve({
        publicId: opaqueId("hold"),
        idempotencyKey: opaqueId("idem"),
        bookingId: second.id,
        departureId: first.departure.id,
        quantity: 2,
        now,
        expiresAt
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.ok(rejected.reason instanceof InventoryUnavailableError);
    assert.equal(await inventory.getAvailableSeats(first.departure.id, now), 1);
    assert.equal(
      await prisma.inventoryHold.count({
        where: { departureId: first.departure.id, status: "ACTIVE" }
      }),
      1
    );
  }
);

test(
  "an inventory idempotency key returns one hold and rejects changed input",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const fixture = await createBookingFixture(4);
    const inventory = new InventoryRepository(prisma);
    const request = {
      publicId: opaqueId("hold"),
      idempotencyKey: opaqueId("idem"),
      bookingId: fixture.booking.id,
      departureId: fixture.departure.id,
      quantity: 2,
      now: new Date("2030-06-20T14:00:00.000Z"),
      expiresAt: new Date("2030-06-20T14:15:00.000Z"),
      requestId: opaqueId("req")
    };

    const first = await inventory.reserve(request);
    const replay = await inventory.reserve(request);

    assert.equal(replay.id, first.id);
    assert.equal(
      await prisma.inventoryHold.count({ where: { idempotencyKey: request.idempotencyKey } }),
      1
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { aggregateId: request.publicId, action: "INVENTORY_HOLD_CREATED" }
      }),
      1
    );
    await assert.rejects(inventory.reserve({ ...request, quantity: 3 }), IdempotencyConflictError);
  }
);

test(
  "an in-transaction inventory reservation rolls back with a later parent-command failure",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const fixture = await createBookingFixture(4);
    const inventory = new InventoryRepository(prisma);
    const request = {
      publicId: opaqueId("hold"),
      idempotencyKey: opaqueId("idem"),
      bookingId: fixture.booking.id,
      departureId: fixture.departure.id,
      quantity: 2,
      now: new Date("2030-06-20T14:00:00.000Z"),
      expiresAt: new Date("2030-06-20T14:15:00.000Z"),
      requestId: opaqueId("req")
    };

    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        await inventory.reserveInTransaction(transaction, request);
        throw new Error("simulate later booking/risk/event write failure");
      })
    );

    assert.equal(
      await prisma.inventoryHold.count({ where: { idempotencyKey: request.idempotencyKey } }),
      0
    );
    assert.equal(await prisma.auditLog.count({ where: { aggregateId: request.publicId } }), 0);
  }
);

test(
  "expired holds release availability using server-provided time and append an audit row",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const fixture = await createBookingFixture(2);
    const inventory = new InventoryRepository(prisma);
    const hold = await inventory.reserve({
      publicId: opaqueId("hold"),
      idempotencyKey: opaqueId("idem"),
      bookingId: fixture.booking.id,
      departureId: fixture.departure.id,
      quantity: 2,
      now: new Date("2030-06-20T14:00:00.000Z"),
      expiresAt: new Date("2030-06-20T14:10:00.000Z")
    });

    const expired = await inventory.expireDue(
      fixture.departure.id,
      new Date("2030-06-20T14:11:00.000Z")
    );

    assert.equal(expired, 1);
    assert.equal(
      (await prisma.inventoryHold.findUniqueOrThrow({ where: { id: hold.id } })).status,
      "EXPIRED"
    );
    assert.equal(
      await inventory.getAvailableSeats(fixture.departure.id, new Date("2030-06-20T14:11:00.000Z")),
      2
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { aggregateId: hold.publicId, action: "INVENTORY_HOLD_EXPIRED" }
      }),
      1
    );
  }
);

test(
  "a receipt trace reaches the call evidence without exposing protected payloads",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const fixture = await createBookingFixture(3);
    const inventory = new InventoryRepository(prisma);
    const hold = await inventory.reserve({
      publicId: opaqueId("hold"),
      idempotencyKey: opaqueId("idem"),
      bookingId: fixture.booking.id,
      departureId: fixture.departure.id,
      quantity: 1,
      now: new Date("2030-06-20T14:00:00.000Z"),
      expiresAt: new Date("2030-06-20T14:15:00.000Z")
    });
    await prisma.inventoryHold.update({
      where: { id: hold.id },
      data: { status: "CONSUMED", consumedAt: new Date("2030-06-20T14:08:00.000Z") }
    });
    await prisma.booking.update({
      where: { id: fixture.booking.id },
      data: {
        status: "RECEIPT_ISSUED",
        contactPhoneEncrypted: "ciphertext:raw-phone",
        contactPhoneMasked: "0912***678"
      }
    });
    const turn = await prisma.transcriptTurn.create({
      data: {
        publicId: opaqueId("turn"),
        callSessionId: fixture.call.id,
        sequenceNo: 1,
        speaker: "CUSTOMER",
        contentRedacted: "private transcript content",
        language: "vi-VN",
        isFinal: true,
        source: "REPLAY"
      }
    });
    const assessment = await prisma.riskAssessment.create({
      data: {
        publicId: opaqueId("risk"),
        callSessionId: fixture.call.id,
        bookingId: fixture.booking.id,
        assessmentVersion: 1,
        policyVersion: "risk-v1",
        completenessScore: 100,
        disputeRiskScore: 0,
        paymentReadinessScore: 100,
        gateDecision: "UNLOCKED",
        nextAction: "OPEN",
        reasonCodes: [],
        evidence: [{ turnId: turn.publicId, rule: "all-required-fields-confirmed" }]
      }
    });
    const agreement = await prisma.agreement.create({
      data: {
        publicId: opaqueId("agr"),
        bookingId: fixture.booking.id,
        inventoryHoldId: hold.id,
        version: 1,
        status: "LOCKED",
        canonicalPayload: { route: "Ha Noi-Sa Pa", passengerCount: 1 },
        payloadHashSha256: "a".repeat(64),
        policyVersion: "BUS-V1/1.0",
        explicitConfirmationMethod: "VOICE",
        confirmedTurnId: turn.id,
        confirmedAt: new Date("2030-06-20T14:05:00.000Z")
      }
    });
    const intent = await prisma.paymentIntent.create({
      data: {
        publicId: opaqueId("pi"),
        bookingId: fixture.booking.id,
        agreementId: agreement.id,
        status: "CONFIRMED",
        currency: "VND",
        amountMinor: 300_000,
        recipientWallet: "mock-recipient",
        solanaReference: opaqueId("ref"),
        memoReference: "demo-server-attestation",
        expiresAt: new Date("2030-06-20T14:15:00.000Z"),
        idempotencyKey: opaqueId("idem")
      }
    });
    const transaction = await prisma.paymentTransaction.create({
      data: {
        paymentIntentId: intent.id,
        chain: "MOCK",
        txSignature: opaqueId("mock_tx"),
        observedAmountMinor: 300_000,
        observedRecipientWallet: "mock-recipient",
        observedReference: intent.solanaReference,
        verificationStatus: "CONFIRMED",
        verifiedAt: new Date("2030-06-20T14:07:00.000Z"),
        rawChainMetadata: { simulated: true }
      }
    });
    const proof = await prisma.proofRecord.create({
      data: {
        publicId: opaqueId("proof"),
        bookingId: fixture.booking.id,
        agreementId: agreement.id,
        paymentTransactionId: transaction.id,
        proofHashSha256: agreement.payloadHashSha256,
        anchorType: "SERVER_ATTESTATION",
        anchorValue: "demo-server-attestation",
        verificationStatus: "MATCH",
        verifiedAt: new Date("2030-06-20T14:08:00.000Z")
      }
    });
    const receipt = await prisma.trustReceipt.create({
      data: {
        publicId: opaqueId("rcpt"),
        bookingId: fixture.booking.id,
        paymentIntentId: intent.id,
        proofRecordId: proof.id,
        status: "VERIFIED_MATCH",
        receiptPayload: { contactMasked: "0912***678", simulated: true },
        issuedAt: new Date("2030-06-20T14:08:00.000Z"),
        verifiedAt: new Date("2030-06-20T14:08:00.000Z")
      }
    });

    const trace = await new ReceiptTraceRepository(prisma).findByPublicId(receipt.publicId);
    const serialized = JSON.stringify(trace);

    assert.ok(trace);
    assert.equal(trace.receipt.publicId, receipt.publicId);
    assert.equal(trace.proof.publicId, proof.publicId);
    assert.equal(trace.paymentTransaction.id, transaction.id);
    assert.equal(trace.paymentIntent.publicId, intent.publicId);
    assert.equal(trace.agreement.publicId, agreement.publicId);
    assert.equal(trace.booking.publicId, fixture.booking.publicId);
    assert.equal(trace.inventoryHold.publicId, hold.publicId);
    assert.equal(trace.riskAssessment?.publicId, assessment.publicId);
    assert.deepEqual(
      trace.transcriptTurns.map((item) => item.publicId),
      [turn.publicId]
    );
    assert.equal(trace.callSession.publicId, fixture.call.publicId);
    assert.doesNotMatch(serialized, /ciphertext:raw-phone/);
    assert.doesNotMatch(serialized, /private transcript content/);
    assert.doesNotMatch(serialized, /canonicalPayload/);
  }
);

test(
  "database constraints preserve locked terms, aggregate ownership, and append-only audit",
  { skip: prisma === undefined ? "TEST_DATABASE_URL is not configured" : false },
  async () => {
    assert.ok(prisma);
    const fixture = await createBookingFixture(4);
    const otherBooking = await prisma.booking.create({
      data: {
        publicId: opaqueId("bk"),
        tripDepartureId: fixture.departure.id,
        status: "BOOKING_DRAFT_READY",
        routeFrom: fixture.departure.routeFrom,
        routeTo: fixture.departure.routeTo,
        departureAtUtc: fixture.departure.departureAtUtc,
        departureTimezone: fixture.departure.departureTimezone,
        passengerCount: 1,
        currency: "VND",
        totalAmountMinor: 300_000,
        depositAmountMinor: 300_000,
        refundPolicyVersion: fixture.departure.refundPolicyVersion
      }
    });
    const inventory = new InventoryRepository(prisma);
    const hold = await inventory.reserve({
      publicId: opaqueId("hold"),
      idempotencyKey: opaqueId("idem"),
      bookingId: fixture.booking.id,
      departureId: fixture.departure.id,
      quantity: 1,
      now: new Date("2030-06-20T14:00:00.000Z"),
      expiresAt: new Date("2030-06-20T14:15:00.000Z")
    });
    const agreement = await prisma.agreement.create({
      data: {
        publicId: opaqueId("agr"),
        bookingId: fixture.booking.id,
        inventoryHoldId: hold.id,
        version: 1,
        status: "LOCKED",
        canonicalPayload: { route: "Ha Noi-Sa Pa", passengerCount: 1 },
        payloadHashSha256: "b".repeat(64),
        policyVersion: "BUS-V1/1.0",
        explicitConfirmationMethod: "WEB",
        confirmedAt: new Date("2030-06-20T14:05:00.000Z")
      }
    });

    await assert.rejects(
      prisma.agreement.update({
        where: { id: agreement.id },
        data: { canonicalPayload: { route: "tampered" } }
      })
    );
    await assert.rejects(
      prisma.paymentIntent.create({
        data: {
          publicId: opaqueId("pi"),
          bookingId: otherBooking.id,
          agreementId: agreement.id,
          status: "CREATED",
          currency: "VND",
          amountMinor: 300_000,
          recipientWallet: "mock-recipient",
          solanaReference: opaqueId("ref"),
          memoReference: "demo-server-attestation",
          expiresAt: new Date("2030-06-20T14:15:00.000Z"),
          idempotencyKey: opaqueId("idem")
        }
      })
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { aggregateId: hold.publicId, action: "INVENTORY_HOLD_CREATED" }
    });
    await assert.rejects(
      prisma.auditLog.update({
        where: { id: audit.id },
        data: { metadata: { tampered: true } }
      })
    );
  }
);
