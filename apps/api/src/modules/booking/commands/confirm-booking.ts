import { createHash } from "node:crypto";

import { BookingStatus, EventName, PaymentGateStatus } from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { createLockedAgreement } from "../agreement/create-locked-agreement.js";
import { recomputeBookingRiskAndEvents } from "./upsert-booking-from-facts.js";
import {
  deriveRisk,
  latestActiveHold,
  latestLockedAgreement,
  loadBookingForRisk,
  transitionBookingThrough
} from "../queries/get-booking-risk-context.js";
import type { BookingStatusValue, ServiceData, Transaction } from "../types.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function confirmBooking(
  transaction: Transaction,
  bookingId: string,
  input: {
    agreementVersion: number;
    confirmation: {
      method: "VOICE" | "WEB" | "OPERATOR";
      confirmedTurnId?: string | undefined;
      text?: string | undefined;
    };
  },
  idempotencyKey: string,
  requestId: string,
  now: Date
): Promise<ServiceData> {
  const idempotencyKeyHash = sha256(idempotencyKey);
  const requestFingerprint = sha256(JSON.stringify({ bookingId, ...input }));
  const replay = await transaction.auditLog.findFirst({
    where: {
      action: "AGREEMENT_CONFIRMED",
      metadata: { path: ["idempotencyKeyHash"], equals: idempotencyKeyHash }
    }
  });
  const metadata = replay?.metadata as { requestFingerprint?: string } | null;
  if (
    replay !== null &&
    (replay.aggregateId !== bookingId || metadata?.requestFingerprint !== requestFingerprint)
  ) {
    throw new ApiCommandError(
      409,
      "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      "Idempotency key was already used with another booking confirmation payload."
    );
  }
  const booking = await loadBookingForRisk(transaction, bookingId);
  const existing = latestLockedAgreement(booking);
  if (existing !== undefined) {
    return {
      bookingId,
      status: BookingStatus.AgreementLocked,
      agreement: {
        agreementId: existing.publicId,
        version: existing.version,
        sha256Hash: existing.payloadHashSha256
      },
      paymentGate: PaymentGateStatus.Unlocked
    };
  }
  if (booking.status !== BookingStatus.AgreementReady) {
    throw new ApiCommandError(
      409,
      "BOOKING_STATE_CONFLICT",
      "Booking terms are not ready for confirmation."
    );
  }
  if (input.agreementVersion !== (booking.agreements[0]?.version ?? 0) + 1) {
    throw new ApiCommandError(
      409,
      "AGREEMENT_VERSION_CONFLICT",
      "Agreement version is not the current confirmable version."
    );
  }
  const hold = latestActiveHold(booking, now);
  if (hold === undefined) {
    throw new ApiCommandError(410, "INVENTORY_HOLD_EXPIRED", "Inventory hold is not active.");
  }
  const risk = deriveRisk(booking, now, {
    refundPolicyConfirmed: true,
    explicitConfirmation: true,
    agreementLocked: false
  });
  if (
    booking.routeFrom === null ||
    booking.routeTo === null ||
    booking.departureAtUtc === null ||
    booking.passengerCount === null ||
    booking.pickupPointDisplay === null ||
    booking.totalAmountMinor === null ||
    booking.depositAmountMinor === null ||
    booking.refundPolicyVersion === null ||
    booking.contactPhoneMasked === null ||
    risk.completenessScore < 85
  ) {
    throw new ApiCommandError(
      422,
      "BOOKING_REQUIRED_FIELD_MISSING",
      "Booking is missing required fields.",
      { reasonCodes: risk.reasonCodes }
    );
  }
  const agreement = await createLockedAgreement(transaction, {
    booking,
    bookingId,
    agreementVersion: input.agreementVersion,
    confirmation: input.confirmation,
    hold,
    now
  });
  await transitionBookingThrough(transaction, booking.id, booking.status as BookingStatusValue, [
    BookingStatus.AgreementLocked
  ]);
  await transaction.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: "AGREEMENT_CONFIRMED",
      aggregateType: "BOOKING",
      aggregateId: booking.publicId,
      requestId,
      afterState: { agreementId: agreement.publicId, version: agreement.version },
      metadata: { idempotencyKeyHash, requestFingerprint },
      createdAt: now
    }
  });
  const call = await transaction.callSession.findFirstOrThrow({ where: { bookingId: booking.id } });
  await appendEvent(transaction, {
    callId: call.publicId,
    bookingId,
    event: EventName.AgreementLocked,
    data: {
      status: BookingStatus.AgreementLocked,
      agreementId: agreement.publicId,
      agreementVersion: agreement.version,
      paymentGate: PaymentGateStatus.Unlocked
    },
    requestId,
    occurredAt: now
  });
  await recomputeBookingRiskAndEvents(transaction, call.publicId, bookingId, {
    requestId,
    occurredAt: now
  });
  return {
    bookingId,
    status: BookingStatus.AgreementLocked,
    agreement: {
      agreementId: agreement.publicId,
      version: agreement.version,
      sha256Hash: agreement.payloadHashSha256
    },
    paymentGate: PaymentGateStatus.Unlocked
  };
}
