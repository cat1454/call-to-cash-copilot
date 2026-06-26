import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { createPrismaClient } from "../packages/db/src/client.js";
import { createRevenueTwinHandlers } from "../apps/api/src/modules/revenue-twin/revenue-twin.handlers.js";
import {
  applyDemoCatalogueFixtures,
  loadPickupPointRows,
  loadRevenueTwinDemandRows,
  loadRevenueTwinPolicyRows,
  loadTripInventoryRows,
  loadTripScheduleRows,
  type TripScheduleRow
} from "./schedule-fixture.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function skipReason() {
  return databaseUrl === undefined ? "TEST_DATABASE_URL is not configured" : false;
}

function fixturePath(fileName: string) {
  return path.join(fixtureDir, fileName);
}

function uniqueSuffix(): string {
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

async function seedCatalogueFixtures(prisma: ReturnType<typeof createPrismaClient>) {
  const pickupRows = loadPickupPointRows(fixturePath("pickup-point-demo.csv"));
  const policyRows = loadRevenueTwinPolicyRows(fixturePath("revenue-twin-policy-demo.csv"));
  const scheduleRows = loadTripScheduleRows(fixturePath("trip-schedule-demo.csv"), {
    pickupRows,
    policyRows
  });
  const inventoryRows = loadTripInventoryRows(fixturePath("trip-inventory-demo.csv"), scheduleRows);
  await applyDemoCatalogueFixtures(prisma, {
    scheduleRows,
    inventoryRows,
    now: new Date("2030-06-20T00:00:00.000Z")
  });
}

async function createAnchorBooking(prisma: ReturnType<typeof createPrismaClient>, suffix: string) {
  const primary = await prisma.tripDeparture.findUniqueOrThrow({
    where: { publicId: "dep_demo_hue_nha_20300620_0700_own" }
  });
  const call = await prisma.callSession.create({
    data: {
      publicId: `call_catalogue_anchor_${suffix}`,
      channelName: `ctc_catalogue_anchor_${suffix}`,
      sourceMode: "DEMO",
      status: "ACTIVE"
    }
  });
  const booking = await prisma.booking.create({
    data: {
      publicId: `bk_catalogue_anchor_${suffix}`,
      callSessionId: call.id,
      tripDepartureId: primary.id,
      status: "AGREEMENT_READY",
      routeFrom: primary.routeFrom,
      routeTo: primary.routeTo,
      departureAtUtc: primary.departureAtUtc,
      passengerCount: 3,
      pickupPointDisplay: "Ben xe phia Nam Hue",
      totalAmountMinor: primary.farePerSeatMinor * 3,
      depositAmountMinor: primary.depositAmountMinor,
      refundPolicyVersion: primary.refundPolicyVersion
    }
  });
  await prisma.callSession.update({ where: { id: call.id }, data: { bookingId: booking.id } });
  return { call, booking, primary };
}

test(
  "Phase 11 anchor evaluates and accepts a real catalogue departure without overselling",
  { skip: skipReason() },
  async () => {
    assert.ok(databaseUrl);
    const prisma = createPrismaClient({ databaseUrl });
    const pickupRows = loadPickupPointRows(fixturePath("pickup-point-demo.csv"));
    const policyRows = loadRevenueTwinPolicyRows(fixturePath("revenue-twin-policy-demo.csv"));
    const scheduleRows = loadTripScheduleRows(fixturePath("trip-schedule-demo.csv"), {
      pickupRows,
      policyRows
    });
    const inventoryRows = loadTripInventoryRows(
      fixturePath("trip-inventory-demo.csv"),
      scheduleRows
    );
    const demand = loadRevenueTwinDemandRows(
      fixturePath("revenue-twin-demand-demo.csv"),
      pickupRows
    ).find((row) => row.requestId === "rtw_req_hue_anchor");
    assert.ok(demand);

    await applyDemoCatalogueFixtures(prisma, {
      scheduleRows,
      inventoryRows,
      now: new Date("2030-06-20T00:00:00.000Z")
    });
    await applyDemoCatalogueFixtures(prisma, {
      scheduleRows,
      inventoryRows,
      now: new Date("2030-06-20T00:00:00.000Z")
    });
    assert.equal(
      await prisma.inventoryHold.count({
        where: {
          publicId: {
            startsWith: "hold_demo_inventory_dep_demo_hue_nha_20300620_0700_own_"
          }
        }
      }),
      1
    );

    const suffix = uniqueSuffix();
    const primary = await prisma.tripDeparture.findUniqueOrThrow({
      where: { publicId: "dep_demo_hue_nha_20300620_0700_own" }
    });
    const cancelled = await prisma.tripDeparture.findUniqueOrThrow({
      where: { publicId: "dep_demo_hue_nha_20300620_0745_cancelled" }
    });
    const outsideFlex = await prisma.tripDeparture.findUniqueOrThrow({
      where: { publicId: "dep_demo_hue_nha_20300620_0800_own" }
    });
    const call = await prisma.callSession.create({
      data: {
        publicId: `call_catalogue_anchor_${suffix}`,
        channelName: `ctc_catalogue_anchor_${suffix}`,
        sourceMode: "DEMO",
        status: "ACTIVE"
      }
    });
    const booking = await prisma.booking.create({
      data: {
        publicId: `bk_catalogue_anchor_${suffix}`,
        callSessionId: call.id,
        tripDepartureId: primary.id,
        status: "AGREEMENT_READY",
        routeFrom: primary.routeFrom,
        routeTo: primary.routeTo,
        departureAtUtc: primary.departureAtUtc,
        passengerCount: demand.passengerCount,
        pickupPointDisplay: "Ben xe phia Nam Hue",
        totalAmountMinor: primary.farePerSeatMinor * demand.passengerCount,
        depositAmountMinor: primary.depositAmountMinor,
        refundPolicyVersion: primary.refundPolicyVersion
      }
    });
    await prisma.callSession.update({ where: { id: call.id }, data: { bookingId: booking.id } });

    const handlers = createRevenueTwinHandlers(prisma);
    const evaluationResult = await handlers.evaluate(call.publicId, `rtw-eval-${suffix}`);
    const evaluation = evaluationResult.evaluation as {
      evaluationId: string;
      status: string;
      requestedDepartureId: string;
      offers: Array<{
        offerId: string;
        alternativeDepartureId: string;
        passengerCount: number;
        finalFareAmountMinor: number;
      }>;
    };

    assert.equal(evaluation.status, demand.expectedStatus);
    assert.equal(evaluation.requestedDepartureId, primary.publicId);
    assert.equal(
      evaluation.offers[0]?.alternativeDepartureId,
      "dep_demo_hue_nha_20300620_0730_own"
    );
    assert.equal(
      evaluation.offers.some((offer) => offer.alternativeDepartureId === cancelled.publicId),
      false
    );
    assert.equal(
      evaluation.offers.some((offer) => offer.alternativeDepartureId === outsideFlex.publicId),
      false
    );

    const persistedOffer = await prisma.revenueTwinOffer.findUniqueOrThrow({
      where: { publicId: evaluation.offers[0]!.offerId },
      include: { alternativeDeparture: true }
    });
    assert.equal(
      persistedOffer.alternativeDeparture.publicId,
      evaluation.offers[0]!.alternativeDepartureId
    );
    assert.equal(persistedOffer.passengerCount, demand.passengerCount);

    const acceptance = await handlers.accept(
      call.publicId,
      evaluation.offers[0]!.offerId,
      {
        callId: call.publicId,
        evaluationId: evaluation.evaluationId,
        offerId: evaluation.offers[0]!.offerId,
        idempotencyKey: `catalogue-anchor-accept-${suffix}`
      },
      `rtw-accept-${suffix}`
    );
    assert.equal(acceptance.status, "ACCEPTED");

    const acceptedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { tripDeparture: true, paymentIntents: true }
    });
    assert.equal(
      acceptedBooking.tripDeparture?.publicId,
      evaluation.offers[0]!.alternativeDepartureId
    );
    assert.equal(acceptedBooking.paymentIntents.length, 0);
    assert.equal(
      await prisma.inventoryHold.count({
        where: {
          bookingId: booking.id,
          departure: { publicId: evaluation.offers[0]!.alternativeDepartureId },
          quantity: demand.passengerCount,
          status: "ACTIVE"
        }
      }),
      1
    );

    await prisma.$disconnect();
  }
);

test(
  "catalogue availability ignores expired holds and stale offers require reevaluation",
  { skip: skipReason() },
  async () => {
    assert.ok(databaseUrl);
    const prisma = createPrismaClient({ databaseUrl });
    await seedCatalogueFixtures(prisma);
    const suffix = uniqueSuffix();
    const { call, booking } = await createAnchorBooking(prisma, `stale_${suffix}`);
    const topAlternative = await prisma.tripDeparture.findUniqueOrThrow({
      where: { publicId: "dep_demo_hue_nha_20300620_0730_own" }
    });
    await prisma.inventoryHold.updateMany({
      where: {
        departureId: topAlternative.id,
        status: "ACTIVE",
        idempotencyKey: { startsWith: "rtw-" }
      },
      data: { status: "RELEASED", releasedAt: new Date(), updatedAt: new Date() }
    });
    const occupiedBeforeExpired = await prisma.inventoryHold.aggregate({
      where: {
        departureId: topAlternative.id,
        OR: [{ status: "CONSUMED" }, { status: "ACTIVE", expiresAt: { gt: new Date() } }]
      },
      _sum: { quantity: true }
    });
    const availableBeforeExpired = Math.max(
      0,
      topAlternative.capacity - (occupiedBeforeExpired._sum.quantity ?? 0)
    );
    await prisma.inventoryHold.create({
      data: {
        publicId: `hold_expired_catalogue_${suffix}`,
        idempotencyKey: `hold-expired-catalogue-${suffix}`,
        bookingId: booking.id,
        departureId: topAlternative.id,
        quantity: 12,
        status: "ACTIVE",
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        createdAt: new Date("2019-12-31T00:00:00.000Z"),
        updatedAt: new Date("2019-12-31T00:00:00.000Z")
      }
    });

    const handlers = createRevenueTwinHandlers(prisma);
    const evaluationResult = await handlers.evaluate(call.publicId, `rtw-expired-hold-${suffix}`);
    const evaluation = evaluationResult.evaluation as {
      evaluationId: string;
      offers: Array<{
        offerId: string;
        alternativeDepartureId: string;
        availableSeatsAtEvaluation: number;
      }>;
    };
    assert.equal(evaluation.offers[0]?.alternativeDepartureId, topAlternative.publicId);
    assert.equal(evaluation.offers[0]?.availableSeatsAtEvaluation, availableBeforeExpired);

    await prisma.tripDeparture.update({
      where: { id: topAlternative.id },
      data: { version: { increment: 1 } }
    });
    const stale = await handlers.accept(
      call.publicId,
      evaluation.offers[0]!.offerId,
      {
        callId: call.publicId,
        evaluationId: evaluation.evaluationId,
        offerId: evaluation.offers[0]!.offerId,
        idempotencyKey: `catalogue-stale-${suffix}`
      },
      `rtw-stale-accept-${suffix}`
    );
    assert.equal(stale.status, "REQUIRES_REEVALUATION");
    assert.equal(
      await prisma.inventoryHold.count({
        where: {
          bookingId: booking.id,
          departure: { publicId: topAlternative.publicId },
          status: "ACTIVE",
          expiresAt: { gt: new Date() }
        }
      }),
      0
    );
    await prisma.$disconnect();
  }
);

test("expired catalogue offers cannot create accepted holds", { skip: skipReason() }, async () => {
  assert.ok(databaseUrl);
  const prisma = createPrismaClient({ databaseUrl });
  await seedCatalogueFixtures(prisma);
  const suffix = uniqueSuffix();
  const { call, booking } = await createAnchorBooking(prisma, `expired_${suffix}`);
  const handlers = createRevenueTwinHandlers(prisma);
  const evaluationResult = await handlers.evaluate(call.publicId, `rtw-offer-expiry-${suffix}`);
  const evaluation = evaluationResult.evaluation as {
    evaluationId: string;
    offers: Array<{ offerId: string; alternativeDepartureId: string }>;
  };
  await prisma.revenueTwinOffer.update({
    where: { publicId: evaluation.offers[0]!.offerId },
    data: { expiresAt: new Date("2020-01-01T00:00:00.000Z") }
  });

  const expired = await handlers.accept(
    call.publicId,
    evaluation.offers[0]!.offerId,
    {
      callId: call.publicId,
      evaluationId: evaluation.evaluationId,
      offerId: evaluation.offers[0]!.offerId,
      idempotencyKey: `catalogue-expired-${suffix}`
    },
    `rtw-expired-accept-${suffix}`
  );
  assert.equal(expired.status, "REQUIRES_REEVALUATION");
  assert.equal(
    await prisma.inventoryHold.count({
      where: {
        bookingId: booking.id,
        departure: { publicId: evaluation.offers[0]!.alternativeDepartureId },
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      }
    }),
    0
  );
  await prisma.$disconnect();
});

test(
  "catalogue fixture DB writes roll back when a later row violates the database natural key",
  { skip: skipReason() },
  async () => {
    assert.ok(databaseUrl);
    const prisma = createPrismaClient({ databaseUrl });
    const suffix = uniqueSuffix()
      .replace(/[^a-f]/gu, "")
      .slice(0, 8)
      .padEnd(8, "a");
    const base: TripScheduleRow = {
      publicId: `dep_demo_rollback_${suffix}_a`,
      routeCode: `ROLLBACK-${suffix.toUpperCase()}`,
      serviceCode: `ROLLBACK-${suffix.toUpperCase()}-A`,
      operatorCode: "ctc_demo_own",
      operatorRelation: "OWN_FLEET",
      routeFromCode: "RBA",
      routeFrom: "Rollback A",
      routeToCode: "RBB",
      routeTo: "Rollback B",
      serviceDate: "2030-06-20",
      localTime: "07:00",
      timezone: "Asia/Ho_Chi_Minh",
      pickupPointCodes: ["HUE_TERMINAL"],
      capacity: 20,
      farePerSeatMinor: 100000,
      depositRuleCode: "DEPOSIT_50K",
      depositAmountMinor: 50000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0",
      incentivePolicyVersion: "SRRRO-V1",
      status: "SCHEDULED",
      departureAtUtc: new Date("2030-06-20T00:00:00.000Z")
    };
    const conflicting: TripScheduleRow = {
      ...base,
      publicId: `dep_demo_rollback_${suffix}_b`,
      serviceCode: `ROLLBACK-${suffix.toUpperCase()}-B`
    };

    await assert.rejects(
      () => applyDemoCatalogueFixtures(prisma, { scheduleRows: [base, conflicting] }),
      /Unique constraint failed/u
    );
    assert.equal(
      await prisma.tripDeparture.count({
        where: { publicId: { in: [base.publicId, conflicting.publicId] } }
      }),
      0
    );
    await prisma.$disconnect();
  }
);
