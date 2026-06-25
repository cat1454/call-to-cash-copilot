import assert from "node:assert/strict";
import test from "node:test";

import {
  AcceptRevenueTwinOfferCommandSchema,
  DeclineRevenueTwinOfferCommandSchema,
  ERROR_CODE_VALUES,
  ErrorCodeSchema,
  EventEnvelopeSchema,
  EventName,
  RevenueTwinDemandContextSchema,
  RevenueTwinDepartureSnapshotSchema,
  RevenueTwinEvaluationResultSchema,
  RevenueTwinIncentivePolicySchema,
  RevenueTwinOverflowOfferSchema
} from "./index.js";

const requestedAt = "2026-06-23T10:00:00.000Z";
const offerExpiresAt = "2026-06-23T10:10:00.000Z";

const demandContext = {
  schemaVersion: "ctc.revenue-twin.demand.v1",
  callId: "call_01JTEST0001",
  routeId: "route_HN-SAPA-001",
  requestedDepartureId: "dep_HN-SAPA-2200",
  passengerCount: 3,
  flexibility: { beforeMinutes: 0, afterMinutes: 60, timeConstraint: "PREFERRED" },
  depositReadiness: "READY",
  groupPolicy: "KEEP_TOGETHER",
  requestedAt
};

const offer = {
  schemaVersion: "ctc.revenue-twin.offer.v1",
  offerId: "rtw_offer_01JTEST0001",
  evaluationId: "rtw_eval_01JTEST0001",
  alternativeDepartureId: "dep_HN-SAPA-2300",
  operatorRelation: "OWN_FLEET",
  rank: 1,
  scheduledAt: "2026-06-23T16:00:00.000Z",
  timeShiftMinutes: 60,
  passengerCount: 3,
  availableSeatsAtEvaluation: 8,
  inventoryVersionAtEvaluation: 4,
  originalFareAmountMinor: 900000,
  discountAmountMinor: 100000,
  finalFareAmountMinor: 800000,
  reasonCodes: ["PRIMARY_DEPARTURE_FULL", "SAME_ROUTE", "FLEET_CAPACITY_AVAILABLE"],
  expiresAt: offerExpiresAt
};

test("Revenue Twin demand context is strict and preserves fixed-time constraints", () => {
  assert.equal(RevenueTwinDemandContextSchema.safeParse(demandContext).success, true);
  assert.equal(
    RevenueTwinDemandContextSchema.safeParse({
      ...demandContext,
      flexibility: { beforeMinutes: 1, afterMinutes: 0, timeConstraint: "FIXED" }
    }).success,
    false
  );
  assert.equal(
    RevenueTwinDemandContextSchema.safeParse({ ...demandContext, customerPhone: "0912345678" })
      .success,
    false
  );
});

test("Revenue Twin departure and offer contracts reject invalid money, capacity, and authority fields", () => {
  const departure = {
    schemaVersion: "ctc.revenue-twin.departure-snapshot.v1",
    departureId: "dep_HN-SAPA-2300",
    operatorId: "op_OWN-001",
    routeId: "route_HN-SAPA-001",
    scheduledAt: "2026-06-23T16:00:00.000Z",
    capacity: 16,
    availableSeats: 8,
    fareAmountMinor: 900000,
    currency: "VND",
    pickupPointIds: ["pickup_MY-DINH"],
    operatorRelation: "OWN_FLEET",
    inventoryVersion: 4,
    observedAt: requestedAt
  };
  assert.equal(RevenueTwinDepartureSnapshotSchema.safeParse(departure).success, true);
  assert.equal(
    RevenueTwinDepartureSnapshotSchema.safeParse({ ...departure, availableSeats: 17 }).success,
    false
  );
  assert.equal(
    RevenueTwinOverflowOfferSchema.safeParse({ ...offer, finalFareAmountMinor: 800001 }).success,
    false
  );
  assert.equal(
    RevenueTwinOverflowOfferSchema.safeParse({ ...offer, rawReasoning: "model trace" }).success,
    false
  );
});

test("Revenue Twin policy, evaluation, and acceptance keep authority server-owned", () => {
  const policy = {
    schemaVersion: "ctc.revenue-twin.incentive-policy.v1",
    policyId: "rtw-policy-default",
    policyVersion: "v1",
    enabled: true,
    maxDiscountAmountMinor: 150000,
    maxDiscountBasisPoints: 2000,
    minimumFinalFareAmountMinor: 600000,
    maximumAlternativeShiftMinutes: 120,
    proactiveRebalancingEnabled: true,
    scarcePrimaryAvailableSeats: 3,
    minimumAlternativeSurplusSeats: 6,
    offerTtlSeconds: 300,
    allowedOperatorRelations: ["OWN_FLEET", "VERIFIED_PARTNER"],
    allowedReasonCodes: ["PRIMARY_DEPARTURE_FULL", "INCENTIVE_POLICY_APPLIED"]
  };
  assert.equal(RevenueTwinIncentivePolicySchema.safeParse(policy).success, true);
  assert.equal(
    RevenueTwinIncentivePolicySchema.safeParse({ ...policy, maxDiscountBasisPoints: 10001 })
      .success,
    false
  );

  assert.equal(
    RevenueTwinEvaluationResultSchema.safeParse({
      schemaVersion: "ctc.revenue-twin.evaluation.v1",
      evaluationId: "rtw_eval_01JTEST0001",
      callId: "call_01JTEST0001",
      status: "OVERFLOW_OFFERS_AVAILABLE",
      requestedDepartureId: "dep_HN-SAPA-2200",
      offers: [offer],
      impact: {
        recoverablePassengerCount: 3,
        potentialGrossRevenueAmountMinor: 800000,
        potentialDiscountCostAmountMinor: 100000,
        potentialNetRevenueRecoveredAmountMinor: 700000
      },
      policyVersion: "v1",
      evaluatedAt: requestedAt
    }).success,
    true
  );

  assert.equal(
    AcceptRevenueTwinOfferCommandSchema.safeParse({
      callId: "call_01JTEST0001",
      evaluationId: "rtw_eval_01JTEST0001",
      offerId: "rtw_offer_01JTEST0001",
      idempotencyKey: "revenue-twin-accept-001"
    }).success,
    true
  );
  assert.equal(
    AcceptRevenueTwinOfferCommandSchema.safeParse({
      callId: "call_01JTEST0001",
      evaluationId: "rtw_eval_01JTEST0001",
      offerId: "rtw_offer_01JTEST0001",
      idempotencyKey: "revenue-twin-accept-001",
      finalFareAmountMinor: 1
    }).success,
    false
  );
  assert.equal(
    DeclineRevenueTwinOfferCommandSchema.safeParse({
      callId: "call_01JTEST0001",
      evaluationId: "rtw_eval_01JTEST0001",
      offerId: "rtw_offer_01JTEST0001"
    }).success,
    true
  );
  assert.equal(
    DeclineRevenueTwinOfferCommandSchema.safeParse({
      callId: "call_01JTEST0001",
      evaluationId: "rtw_eval_01JTEST0001",
      offerId: "rtw_offer_01JTEST0001",
      finalFareAmountMinor: 1
    }).success,
    false
  );
});

test("Revenue Twin events use the existing envelope and contain only safe offer facts", () => {
  const event = EventEnvelopeSchema.safeParse({
    eventId: "evt_01JTEST0001",
    event: EventName.RevenueTwinEvaluated,
    version: 1,
    occurredAt: requestedAt,
    callId: "call_01JTEST0001",
    bookingId: null,
    sequence: 1,
    data: {
      evaluationId: "rtw_eval_01JTEST0001",
      status: "OVERFLOW_OFFERS_AVAILABLE",
      requestedDepartureId: "dep_HN-SAPA-2200",
      offerCount: 1,
      recoverablePassengerCount: 3,
      potentialNetRevenueRecoveredAmountMinor: 700000,
      reasonCodes: ["PRIMARY_DEPARTURE_FULL"],
      evaluatedAt: requestedAt
    }
  });
  assert.equal(event.success, true);
  assert.equal(
    EventEnvelopeSchema.safeParse({
      ...event.data,
      data: { ...event.data.data, rawTranscript: "x" }
    }).success,
    false
  );
});

test("Revenue Twin error codes are registered once in the shared safe-error vocabulary", () => {
  const expected = [
    "REVENUE_TWIN_EVALUATION_NOT_FOUND",
    "REVENUE_TWIN_OFFER_NOT_FOUND",
    "REVENUE_TWIN_OFFER_EXPIRED",
    "REVENUE_TWIN_OFFER_ALREADY_DECIDED",
    "REVENUE_TWIN_NO_ELIGIBLE_ALTERNATIVE",
    "REVENUE_TWIN_GROUP_CAPACITY_UNAVAILABLE",
    "REVENUE_TWIN_POLICY_DISABLED",
    "REVENUE_TWIN_POLICY_REJECTED",
    "REVENUE_TWIN_UNVERIFIED_PARTNER",
    "REVENUE_TWIN_INVENTORY_CHANGED",
    "REVENUE_TWIN_STALE_SNAPSHOT",
    "REVENUE_TWIN_REEVALUATION_REQUIRED",
    "REVENUE_TWIN_INVALID_FLEXIBILITY",
    "REVENUE_TWIN_IDEMPOTENCY_CONFLICT"
  ] as const;
  assert.equal(new Set(ERROR_CODE_VALUES).size, ERROR_CODE_VALUES.length);
  for (const code of expected) {
    assert.equal(ERROR_CODE_VALUES.includes(code), true);
    assert.equal(ErrorCodeSchema.safeParse(code).success, true);
  }
});
