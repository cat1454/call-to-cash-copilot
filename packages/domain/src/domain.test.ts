import assert from "node:assert/strict";
import test from "node:test";

import {
  AgreementStatus,
  BookingField,
  BookingStatus,
  CallStatus,
  ConfirmationMethod,
  Currency,
  PaymentGateStatus,
  PaymentIntentStatus,
  ReceiptStatus,
  type Agreement,
  type BookingDraft,
  type BookingExtraction,
  type RevenueTwinOverflowOffer
} from "@call-to-cash/shared";

import {
  applyBookingExtraction,
  applyMaterialChange,
  calculateCompleteness,
  calculateDisputeRisk,
  calculatePaymentReadiness,
  canCreatePaymentIntent,
  evaluatePaymentGate,
  getRequiredNextAction,
  isInventoryHoldActive,
  serializeCanonicalAgreement,
  transitionBooking,
  transitionCall,
  transitionPaymentIntent,
  transitionReceipt,
  validateRevenueTwinOfferAcceptance,
  allocatePriorityFcfs,
  calculateRevenueTwinIncentive,
  createRevenueTwinDemoFixture,
  evaluateRevenueTwin,
  runRevenueTwinSimulation,
  validateBookingFields
} from "./index.js";

const now = "2026-06-20T10:30:00.000Z";
const later = "2026-06-20T11:30:00.000Z";

function validBooking(): BookingDraft {
  return {
    bookingId: "bk_01JTEST0001",
    status: BookingStatus.AgreementLocked,
    service: {
      vertical: "INTERCITY_BUS",
      routeFrom: "Hà Nội",
      routeTo: "Sa Pa",
      departureAt: "2026-06-20T22:30:00+07:00",
      passengerCount: 3,
      pickupPoint: "Mỹ Đình",
      inventoryReservationId: "hold_01JTEST0001",
      inventoryHoldExpiresAt: later
    },
    customer: { contactMasked: "0912***678" },
    pricing: {
      fareTotalVnd: 900000,
      depositAmountVnd: 300000,
      currency: Currency.Vnd,
      refundPolicyVersion: "BUS-V1"
    },
    confirmations: {
      refundPolicyConfirmed: true,
      explicitConfirmation: true,
      explicitConfirmationForAgreementVersion: 1
    },
    provenance: {},
    createdAt: now,
    updatedAt: now
  };
}

function validAgreement(): Agreement {
  return {
    agreementId: "agr_01JTEST0001",
    bookingId: "bk_01JTEST0001",
    version: 1,
    status: AgreementStatus.Locked,
    service: {
      routeFrom: " Hà Nội ",
      routeTo: "Sa Pa",
      departureAt: "2026-06-20T22:30:00+07:00",
      passengerCount: 3,
      pickupPoint: "Mỹ Đình",
      inventoryReservationId: "hold_01JTEST0001",
      holdExpiresAt: later
    },
    commercialTerms: {
      fareTotalVnd: 900000,
      depositAmountVnd: 300000,
      currency: Currency.Vnd,
      refundPolicyVersion: "BUS-V1",
      refundPolicySummary: " Hoàn 80% khi báo trước 12 giờ "
    },
    customerAcknowledgement: {
      contactMasked: "0912***678",
      explicitConfirmationAt: now,
      confirmationMethod: ConfirmationMethod.Voice
    },
    canonicalizationVersion: "v1",
    createdAt: now
  };
}

function passingGateInput() {
  return {
    completenessScore: 100,
    disputeRisk: 0,
    paymentReadiness: 100,
    explicitConfirmation: true,
    agreementLocked: true,
    inventoryHoldActive: true,
    blockingReasons: [],
    criticalBlockers: []
  };
}

test("booking field validation identifies missing terms without converting ordinary gaps into manual review", () => {
  const booking = validBooking();
  const bookingWithoutPickup = structuredClone(booking);
  delete bookingWithoutPickup.service.pickupPoint;
  const validation = validateBookingFields({
    booking: bookingWithoutPickup,
    inventoryHoldActive: true,
    now
  });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.missingFields, [BookingField.PickupPoint]);
  assert.deepEqual(validation.reasonCodes, ["MISSING_PICKUP_POINT"]);
  assert.equal(
    evaluatePaymentGate({ ...passingGateInput(), blockingReasons: validation.reasonCodes }),
    PaymentGateStatus.Locked
  );
});

test("required policy acceptance prepares confirmation without opening payment", () => {
  const policyValidation = validateBookingFields({
    booking: {
      ...validBooking(),
      confirmations: {
        refundPolicyConfirmed: false,
        explicitConfirmation: true,
        explicitConfirmationForAgreementVersion: 1
      }
    },
    inventoryHoldActive: true,
    now
  });

  assert.equal(
    evaluatePaymentGate({
      ...passingGateInput(),
      blockingReasons: policyValidation.reasonCodes,
      explicitConfirmation: false,
      agreementLocked: false,
      paymentReadiness: 20
    }),
    PaymentGateStatus.ReadyForConfirmation
  );
  assert.equal(
    evaluatePaymentGate({ ...passingGateInput(), inventoryHoldActive: false }),
    PaymentGateStatus.Locked
  );
  assert.equal(
    evaluatePaymentGate({
      ...passingGateInput(),
      explicitConfirmation: false,
      paymentReadiness: 75
    }),
    PaymentGateStatus.ReadyForConfirmation
  );
});

test("scores are deterministic and documented risk signals are capped", () => {
  assert.equal(
    calculateCompleteness({
      routeValid: true,
      departureValid: true,
      passengerCountValid: true,
      pickupPointValid: true,
      contactValid: true,
      inventoryHoldActive: true,
      pricingCurrent: true,
      depositCalculated: true,
      refundPolicyAttached: true,
      termsRenderable: true
    }),
    100
  );
  assert.equal(
    calculatePaymentReadiness({
      termsRendered: true,
      totalPriceConfirmed: true,
      depositConfirmed: true,
      refundPolicyConfirmed: true,
      explicitConfirmation: true,
      paymentIntentReady: true
    }),
    100
  );
  assert.equal(
    calculateDisputeRisk([
      { code: "AMBIGUOUS_CONFIRMATION", status: "ACTIVE" },
      { code: "PRICE_NOT_CONFIRMED", status: "RESOLVED" },
      { code: "PAYMENT_RECIPIENT_MISMATCH", status: "ACTIVE" }
    ]),
    100
  );
});

test("a critical proof exception always blocks and routes for manual review", () => {
  const decision = evaluatePaymentGate({
    ...passingGateInput(),
    criticalBlockers: ["PROOF_MISMATCH"]
  });

  assert.equal(decision, PaymentGateStatus.ManualReviewRequired);
  assert.equal(getRequiredNextAction(decision), "BLOCK");
});

test("a valid confirmed agreement is the only happy path that opens the payment gate", () => {
  assert.equal(evaluatePaymentGate(passingGateInput()), PaymentGateStatus.Unlocked);
  assert.equal(getRequiredNextAction(PaymentGateStatus.Unlocked), "OPEN");
  assert.equal(
    canCreatePaymentIntent({
      bookingStatus: BookingStatus.AgreementLocked,
      paymentGate: PaymentGateStatus.Unlocked,
      inventoryHoldActive: true,
      hasActivePaymentIntent: false,
      paymentOrReceiptFinalized: false
    }).allowed,
    true
  );
  assert.deepEqual(
    canCreatePaymentIntent({
      bookingStatus: BookingStatus.AgreementLocked,
      paymentGate: PaymentGateStatus.Unlocked,
      inventoryHoldActive: true,
      hasActivePaymentIntent: true,
      paymentOrReceiptFinalized: false
    }).reasonCodes,
    ["PAYMENT_INTENT_ALREADY_EXISTS"]
  );
});

test("accepted extraction stays proposed until an explicit agreement confirmation", () => {
  const booking = validBooking();
  const extraction: BookingExtraction = {
    extractionId: "ext_01JTEST0001",
    callId: "call_01JTEST0001",
    status: "ACCEPTED",
    extractedFields: { passengerCount: 4 },
    fieldConfidence: { passengerCount: 0.98 },
    missingFields: [],
    contradictions: [],
    createdAt: now
  };

  const result = applyBookingExtraction(booking, extraction);

  assert.equal(result.booking.service.passengerCount, 4);
  assert.equal(result.booking.provenance.passengerCount?.status, "proposed");
  assert.equal(result.booking.confirmations.explicitConfirmation, false);
  assert.equal(result.booking.status, BookingStatus.AgreementReady);
});

test("material term changes invalidate confirmation without mutating the original draft", () => {
  const booking = validBooking();
  const result = applyMaterialChange(booking, { depositAmountVnd: 350000 });

  assert.deepEqual(result.changedFields, ["depositAmountVnd"]);
  assert.equal(result.booking.pricing.depositAmountVnd, 350000);
  assert.equal(result.booking.confirmations.explicitConfirmation, false);
  assert.equal(result.booking.confirmations.explicitConfirmationForAgreementVersion, undefined);
  assert.equal(result.booking.status, BookingStatus.AgreementReady);
  assert.equal(booking.confirmations.explicitConfirmation, true);
});

test("state transitions reject skipped states and permit only documented paths", () => {
  assert.equal(transitionCall(CallStatus.Created, CallStatus.Active).ok, true);
  assert.equal(transitionCall(CallStatus.Created, CallStatus.Ended).ok, false);
  assert.equal(transitionBooking(BookingStatus.Draft, BookingStatus.PaymentConfirmed).ok, false);
  assert.equal(
    transitionBooking(BookingStatus.AgreementReady, BookingStatus.AgreementLocked).ok,
    true
  );
  assert.equal(
    transitionPaymentIntent(PaymentIntentStatus.Created, PaymentIntentStatus.Confirmed).ok,
    false
  );
  assert.equal(
    transitionPaymentIntent(PaymentIntentStatus.Pending, PaymentIntentStatus.Confirmed).ok,
    true
  );
  assert.equal(transitionReceipt(ReceiptStatus.Issued, ReceiptStatus.VerifiedMatch).ok, true);
  assert.equal(
    transitionBooking(BookingStatus.ReceiptIssued, BookingStatus.ManualReviewRequired).ok,
    true
  );
  assert.equal(transitionReceipt(ReceiptStatus.VerifiedMatch, ReceiptStatus.Mismatch).ok, true);
  assert.equal(transitionReceipt(ReceiptStatus.NotCreated, ReceiptStatus.VerifiedMatch).ok, false);
});

test("inventory activity is server-time based and canonical agreement output is stable and PII-safe", () => {
  assert.equal(isInventoryHoldActive(true, later, now), true);
  assert.equal(isInventoryHoldActive(true, now, now), false);

  const agreement = validAgreement();
  const reordered = {
    ...agreement,
    service: {
      holdExpiresAt: agreement.service.holdExpiresAt,
      inventoryReservationId: agreement.service.inventoryReservationId,
      pickupPoint: agreement.service.pickupPoint,
      passengerCount: agreement.service.passengerCount,
      departureAt: agreement.service.departureAt,
      routeTo: agreement.service.routeTo,
      routeFrom: agreement.service.routeFrom
    },
    commercialTerms: {
      refundPolicySummary: agreement.commercialTerms.refundPolicySummary,
      refundPolicyVersion: agreement.commercialTerms.refundPolicyVersion,
      currency: agreement.commercialTerms.currency,
      depositAmountVnd: agreement.commercialTerms.depositAmountVnd,
      fareTotalVnd: agreement.commercialTerms.fareTotalVnd
    }
  } satisfies Agreement;

  const canonical = serializeCanonicalAgreement(agreement);

  assert.equal(canonical, serializeCanonicalAgreement(reordered));
  assert.equal(canonical.includes("0912***678"), false);
  assert.equal(canonical.includes("2026-06-20T15:30:00.000Z"), true);
});

test("Revenue Twin acceptance contract requires a fresh, unexpired offer without creating a hold", () => {
  const offer: RevenueTwinOverflowOffer = {
    schemaVersion: "ctc.revenue-twin.offer.v1",
    offerId: "rtw_offer_01JTEST0001",
    evaluationId: "rtw_eval_01JTEST0001",
    alternativeDepartureId: "dep_HN-SAPA-2300",
    operatorRelation: "OWN_FLEET",
    rank: 1,
    scheduledAt: later,
    timeShiftMinutes: 60,
    passengerCount: 3,
    availableSeatsAtEvaluation: 8,
    inventoryVersionAtEvaluation: 4,
    originalFareAmountMinor: 900000,
    discountAmountMinor: 100000,
    finalFareAmountMinor: 800000,
    reasonCodes: ["PRIMARY_DEPARTURE_FULL"],
    expiresAt: later
  };

  assert.deepEqual(
    validateRevenueTwinOfferAcceptance({
      offer,
      now,
      currentInventoryVersion: 4,
      policyVersion: "v1",
      evaluatedPolicyVersion: "v1"
    }),
    { allowed: true }
  );
  assert.deepEqual(
    validateRevenueTwinOfferAcceptance({
      offer,
      now,
      currentInventoryVersion: 5,
      policyVersion: "v1",
      evaluatedPolicyVersion: "v1"
    }),
    { allowed: false, reason: "STALE_INVENTORY_SNAPSHOT" }
  );
});

test("Scenario-Robust Revenue Rebalancing Optimizer preserves FCFS priority and returns bounded overflow offers", () => {
  const allocated = allocatePriorityFcfs(5, [
    { id: "first", passengerCount: 3 },
    { id: "second", passengerCount: 3 },
    { id: "third", passengerCount: 2 }
  ]);
  assert.deepEqual(
    allocated.primary.map((item) => item.id),
    ["first", "third"]
  );
  assert.deepEqual(
    allocated.overflow.map((item) => item.id),
    ["second"]
  );

  const demand = {
    schemaVersion: "ctc.revenue-twin.demand.v1" as const,
    callId: "call_01JTEST0001",
    routeId: "route_HN-SAPA-001",
    requestedDepartureId: "dep_HN-SAPA-2200",
    passengerCount: 3,
    flexibility: { beforeMinutes: 0, afterMinutes: 120, timeConstraint: "PREFERRED" as const },
    depositReadiness: "READY" as const,
    groupPolicy: "KEEP_TOGETHER" as const,
    requestedAt: now
  };
  const primary = {
    schemaVersion: "ctc.revenue-twin.departure-snapshot.v1" as const,
    departureId: "dep_HN-SAPA-2200",
    operatorId: "op_OWN-001",
    routeId: demand.routeId,
    scheduledAt: now,
    capacity: 20,
    availableSeats: 0,
    fareAmountMinor: 200_000,
    currency: "VND" as const,
    pickupPointIds: ["pickup_MY-DINH"],
    operatorRelation: "OWN_FLEET" as const,
    inventoryVersion: 1,
    observedAt: now
  };
  const policy = {
    schemaVersion: "ctc.revenue-twin.incentive-policy.v1" as const,
    policyId: "rtw-default",
    policyVersion: "v1",
    enabled: true,
    maxDiscountAmountMinor: 30_000,
    maxDiscountBasisPoints: 2_000,
    minimumFinalFareAmountMinor: 170_000,
    maximumAlternativeShiftMinutes: 120,
    offerTtlSeconds: 120,
    allowedOperatorRelations: ["OWN_FLEET", "VERIFIED_PARTNER"] as (
      | "OWN_FLEET"
      | "VERIFIED_PARTNER"
    )[],
    allowedReasonCodes: ["PRIMARY_DEPARTURE_FULL", "INCENTIVE_POLICY_APPLIED"] as (
      | "PRIMARY_DEPARTURE_FULL"
      | "INCENTIVE_POLICY_APPLIED"
    )[]
  };
  const alternative = {
    ...primary,
    departureId: "dep_HN-SAPA-2230",
    scheduledAt: later,
    availableSeats: 12,
    inventoryVersion: 2
  };
  const result = evaluateRevenueTwin(
    {
      demand,
      primaryDeparture: primary,
      alternativeDepartures: [alternative],
      incentivePolicy: policy
    },
    {
      evaluationId: "rtw_eval_01JTEST0001",
      offerIdForRank: (rank) => `rtw_offer_01JTEST000${rank}`,
      now: new Date(now)
    }
  );
  assert.equal(result.status, "OVERFLOW_OFFERS_AVAILABLE");
  assert.equal(result.offers.length, 1);
  const firstOffer = result.offers[0];
  assert.ok(firstOffer);
  assert.equal(firstOffer.finalFareAmountMinor >= policy.minimumFinalFareAmountMinor, true);
  assert.equal(
    result.impact.potentialNetRevenueRecoveredAmountMinor,
    firstOffer.finalFareAmountMinor * demand.passengerCount
  );
  const terms = calculateRevenueTwinIncentive(alternative, demand, policy, 60);
  assert.ok(terms);
  assert.equal(terms.finalFareAmountMinor, alternative.fareAmountMinor - terms.discountAmountMinor);
});

test("Revenue Twin demo simulation is seeded, FCFS, group-safe, and has no provider side effects", () => {
  const fixture = createRevenueTwinDemoFixture();
  const input = {
    mode: "DEMO_FIXTURE" as const,
    seed: 42,
    primaryAvailableSeats: fixture.primaryDeparture.availableSeats,
    alternativeAvailableSeats: fixture.alternativeDepartures.map(
      (departure) => departure.availableSeats
    ),
    requests: fixture.requests
  };
  const first = runRevenueTwinSimulation(input);
  const replay = runRevenueTwinSimulation(input);
  assert.deepEqual(first, replay);
  assert.deepEqual(fixture.primaryDeparture, {
    scheduledAt: "07:00",
    capacity: 20,
    availableSeats: 5
  });
  assert.deepEqual(
    fixture.alternativeDepartures.map((departure) => departure.scheduledAt),
    ["07:30", "08:00"]
  );
  assert.equal(first.metrics.primaryAllocatedPassengerCount, 5);
  assert.equal(first.metrics.requestCount, 10);
  assert.equal(first.decisions.filter((decision) => decision.allocation === "PRIMARY").length, 5);
  assert.equal(
    first.metrics.remainingAlternativeSeats.every((seats) => seats >= 0),
    true
  );
});

test("Revenue Twin priority allocation follows request time rather than caller array order", () => {
  const result = runRevenueTwinSimulation({
    mode: "DRY_RUN",
    seed: 1,
    primaryAvailableSeats: 2,
    alternativeAvailableSeats: [],
    requests: [
      {
        requestId: "late",
        passengerCount: 2,
        requestedAt: "2030-01-01T10:02:00.000Z",
        timeConstraint: "PREFERRED",
        depositReadiness: "READY"
      },
      {
        requestId: "first",
        passengerCount: 1,
        requestedAt: "2030-01-01T10:00:00.000Z",
        timeConstraint: "PREFERRED",
        depositReadiness: "READY"
      },
      {
        requestId: "second",
        passengerCount: 1,
        requestedAt: "2030-01-01T10:01:00.000Z",
        timeConstraint: "PREFERRED",
        depositReadiness: "READY"
      }
    ]
  });

  assert.deepEqual(
    result.decisions
      .filter((decision) => decision.allocation === "PRIMARY")
      .map((decision) => decision.requestId),
    ["first", "second"]
  );
});
