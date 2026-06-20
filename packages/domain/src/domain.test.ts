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
  type BookingExtraction
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

test("required policy acceptance, confirmation, and active inventory each prevent payment opening", () => {
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
    evaluatePaymentGate({ ...passingGateInput(), blockingReasons: policyValidation.reasonCodes }),
    PaymentGateStatus.Locked
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
