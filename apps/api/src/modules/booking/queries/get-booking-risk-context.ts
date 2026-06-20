import {
  calculateCompleteness,
  calculateDisputeRisk,
  calculatePaymentReadiness,
  evaluatePaymentGate,
  getRequiredNextAction,
  transitionBooking,
  validateBookingFields,
  type CriticalBlockerCode,
  type StateTransitionResult
} from "@call-to-cash/domain";
import {
  Currency,
  PaymentGateStatus,
  type BookingDraft,
  type RiskReasonCode
} from "@call-to-cash/shared";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import type { BookingForRisk, BookingStatusValue, Transaction } from "../types.js";

function iso(date: Date): string {
  return date.toISOString();
}

function customerMessageFor(reasonCodes: readonly RiskReasonCode[], gate: string): string {
  if (gate === PaymentGateStatus.Unlocked) {
    return "Booking terms are confirmed and the payment gate is open.";
  }
  if (reasonCodes.includes("REFUND_POLICY_NOT_CONFIRMED")) {
    return "Refund policy and deposit terms must be explicitly confirmed before payment.";
  }
  if (reasonCodes.includes("MISSING_PICKUP_POINT")) {
    return "Pickup point is still required before deposit.";
  }
  if (reasonCodes.includes("MISSING_CONTACT")) {
    return "A contact phone number is required before deposit.";
  }
  if (reasonCodes.includes("INVENTORY_UNAVAILABLE")) {
    return "Inventory must be held before payment.";
  }

  return "More booking details are required before payment.";
}

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }
  return result.status;
}

export async function transitionBookingThrough(
  transaction: Transaction,
  bookingId: string,
  currentStatus: BookingStatusValue,
  targets: readonly BookingStatusValue[]
): Promise<BookingStatusValue> {
  let status = currentStatus;
  for (const target of targets) {
    status = requireTransition(
      transitionBooking(status, target),
      "Booking state transition is not allowed."
    );
    await transaction.booking.update({
      where: { id: bookingId },
      data: { status, version: { increment: 1 } }
    });
  }
  return status;
}

export function latestActiveHold(booking: BookingForRisk, now: Date) {
  return booking.inventoryHolds.find(
    (hold) => hold.status === "ACTIVE" && hold.expiresAt.getTime() > now.getTime()
  );
}

export function latestLockedAgreement(booking: BookingForRisk) {
  return booking.agreements.find((agreement) => agreement.status === "LOCKED");
}

function bookingDraftFromRecord(
  booking: BookingForRisk,
  input: {
    now: Date;
    refundPolicyConfirmed: boolean;
    explicitConfirmation: boolean;
    agreementLocked: boolean;
  }
): BookingDraft {
  const hold = latestActiveHold(booking, input.now);
  return {
    bookingId: booking.publicId,
    status: booking.status as BookingDraft["status"],
    service: {
      vertical: "INTERCITY_BUS",
      ...(booking.routeFrom === null ? {} : { routeFrom: booking.routeFrom }),
      ...(booking.routeTo === null ? {} : { routeTo: booking.routeTo }),
      ...(booking.departureAtUtc === null ? {} : { departureAt: iso(booking.departureAtUtc) }),
      ...(booking.passengerCount === null ? {} : { passengerCount: booking.passengerCount }),
      ...(booking.pickupPointDisplay === null ? {} : { pickupPoint: booking.pickupPointDisplay }),
      ...(hold === undefined
        ? {}
        : { inventoryReservationId: hold.publicId, inventoryHoldExpiresAt: iso(hold.expiresAt) })
    },
    customer:
      booking.contactPhoneMasked === null ? {} : { contactMasked: booking.contactPhoneMasked },
    pricing: {
      currency: Currency.Vnd,
      ...(booking.totalAmountMinor === null ? {} : { fareTotalVnd: booking.totalAmountMinor }),
      ...(booking.depositAmountMinor === null
        ? {}
        : { depositAmountVnd: booking.depositAmountMinor }),
      ...(booking.refundPolicyVersion === null
        ? {}
        : { refundPolicyVersion: booking.refundPolicyVersion })
    },
    confirmations: {
      refundPolicyConfirmed: input.refundPolicyConfirmed,
      explicitConfirmation: input.explicitConfirmation,
      ...(input.agreementLocked ? { explicitConfirmationForAgreementVersion: 1 } : {})
    },
    provenance: {},
    createdAt: iso(input.now),
    updatedAt: iso(input.now)
  };
}

export function isOperationallyReady(booking: BookingForRisk, now: Date): boolean {
  return (
    booking.routeFrom !== null &&
    booking.routeTo !== null &&
    booking.departureAtUtc !== null &&
    booking.passengerCount !== null &&
    booking.pickupPointDisplay !== null &&
    booking.contactPhoneMasked !== null &&
    booking.totalAmountMinor !== null &&
    booking.depositAmountMinor !== null &&
    booking.refundPolicyVersion !== null &&
    latestActiveHold(booking, now) !== undefined
  );
}

export function deriveRisk(
  booking: BookingForRisk,
  now: Date,
  input: {
    refundPolicyConfirmed: boolean;
    explicitConfirmation: boolean;
    agreementLocked: boolean;
    criticalBlockers?: CriticalBlockerCode[];
  }
) {
  const hold = latestActiveHold(booking, now);
  const validation = validateBookingFields({
    booking: bookingDraftFromRecord(booking, { now, ...input }),
    inventoryHoldActive: hold !== undefined,
    now
  });
  const completenessScore = calculateCompleteness({
    routeValid: booking.routeFrom !== null && booking.routeTo !== null,
    departureValid: booking.departureAtUtc !== null && booking.departureAtUtc > now,
    passengerCountValid: booking.passengerCount !== null && booking.passengerCount > 0,
    pickupPointValid: booking.pickupPointDisplay !== null,
    contactValid: booking.contactPhoneMasked !== null,
    inventoryHoldActive: hold !== undefined,
    pricingCurrent: booking.totalAmountMinor !== null,
    depositCalculated: booking.depositAmountMinor !== null && booking.depositAmountMinor > 0,
    refundPolicyAttached: booking.refundPolicyVersion !== null,
    termsRenderable: isOperationallyReady(booking, now)
  });
  const criticalBlockers = input.criticalBlockers ?? [];
  const blockerReasonCodes: RiskReasonCode[] = criticalBlockers.flatMap((code) =>
    code === "PAYMENT_OR_RECEIPT_ALREADY_FINALIZED" ? [] : [code as RiskReasonCode]
  );
  const reasonCodes: RiskReasonCode[] = [
    ...new Set<RiskReasonCode>([...validation.reasonCodes, ...blockerReasonCodes])
  ];
  const disputeRisk = calculateDisputeRisk(
    blockerReasonCodes.map((code) => ({ code, status: "ACTIVE" as const }))
  );
  const paymentReadiness = calculatePaymentReadiness({
    termsRendered: isOperationallyReady(booking, now),
    totalPriceConfirmed: input.agreementLocked,
    depositConfirmed: input.agreementLocked,
    refundPolicyConfirmed: input.refundPolicyConfirmed,
    explicitConfirmation: input.explicitConfirmation,
    paymentIntentReady: input.agreementLocked
  });
  const paymentGate = evaluatePaymentGate({
    completenessScore,
    disputeRisk,
    paymentReadiness,
    explicitConfirmation: input.explicitConfirmation,
    agreementLocked: input.agreementLocked,
    inventoryHoldActive: hold !== undefined,
    blockingReasons: validation.reasonCodes,
    criticalBlockers
  });

  return {
    completenessScore,
    disputeRisk,
    paymentReadiness,
    paymentGate,
    nextAction: getRequiredNextAction(paymentGate),
    missingFields: validation.missingFields,
    reasonCodes,
    evidence: reasonCodes.map((code) => ({ rule: code })),
    customerMessage: customerMessageFor(reasonCodes, paymentGate)
  };
}

export async function loadBookingForRisk(
  transaction: Transaction,
  publicId: string
): Promise<BookingForRisk> {
  const booking = await transaction.booking.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      status: true,
      routeFrom: true,
      routeTo: true,
      departureAtUtc: true,
      departureTimezone: true,
      passengerCount: true,
      pickupPointDisplay: true,
      contactPhoneMasked: true,
      totalAmountMinor: true,
      depositAmountMinor: true,
      refundPolicyVersion: true
    }
  });
  if (booking === null) {
    throw new ApiCommandError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
  }
  const [inventoryHolds, agreements, paymentIntents] = await Promise.all([
    transaction.inventoryHold.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicId: true, status: true, quantity: true, expiresAt: true }
    }),
    transaction.agreement.findMany({
      where: { bookingId: booking.id },
      orderBy: { version: "desc" },
      select: { id: true, publicId: true, version: true, status: true, payloadHashSha256: true }
    }),
    transaction.paymentIntent.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      select: { publicId: true, status: true }
    })
  ]);
  return { ...booking, inventoryHolds, agreements, paymentIntents };
}
