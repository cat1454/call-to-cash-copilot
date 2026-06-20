import { canCreatePaymentIntent } from "@call-to-cash/domain";
import type { DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  PaymentGateStatus,
  PaymentIntentStatus,
  type BookingDraft
} from "@call-to-cash/shared";

import {
  latestActiveHold,
  latestLockedAgreement,
  loadBookingForRisk
} from "../../booking/queries/get-booking-risk-context.js";
import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { createMockPaymentExpectation } from "../../../platform/providers/mock-payment-provider.js";
import { presentPaymentIntent } from "../payment.presenter.js";
import type { MockPaymentCreateResult, Transaction } from "../types.js";
import { iso, opaqueId, transitionBookingThrough } from "../types.js";

const ACTIVE_PAYMENT_STATUSES = ["CREATED", "PENDING", "FAILED"] as const;

export async function createPaymentIntent(
  transaction: Transaction,
  bookingId: string,
  idempotencyKey: string,
  requestId: string,
  now: Date
): Promise<MockPaymentCreateResult> {
  const existingForKey = await transaction.paymentIntent.findUnique({ where: { idempotencyKey } });
  if (existingForKey !== null) {
    const existingBooking = await transaction.booking.findUniqueOrThrow({
      where: { id: existingForKey.bookingId },
      select: { publicId: true }
    });
    if (existingBooking.publicId !== bookingId) {
      throw new ApiCommandError(
        409,
        "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
        "Idempotency key was already used for another payment intent."
      );
    }
    const agreement = await transaction.agreement.findUniqueOrThrow({
      where: { id: existingForKey.agreementId },
      select: { publicId: true }
    });
    return presentPaymentIntent({
      statusCode: 200,
      bookingId,
      agreementId: agreement.publicId,
      intent: existingForKey
    });
  }

  const booking = await loadBookingForRisk(transaction, bookingId);
  const agreement = latestLockedAgreement(booking);
  const hold = latestActiveHold(booking, now);
  const latestRisk = await transaction.riskAssessment.findFirst({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" }
  });
  const hasActivePaymentIntent = booking.paymentIntents.some((intent) =>
    ACTIVE_PAYMENT_STATUSES.includes(intent.status as (typeof ACTIVE_PAYMENT_STATUSES)[number])
  );
  const eligibility = canCreatePaymentIntent({
    bookingStatus: booking.status as BookingDraft["status"],
    paymentGate: latestRisk?.gateDecision ?? PaymentGateStatus.Locked,
    inventoryHoldActive: hold !== undefined,
    hasActivePaymentIntent,
    paymentOrReceiptFinalized: booking.paymentIntents.some(
      (intent) => intent.status === "CONFIRMED"
    )
  });
  if (!eligibility.allowed || agreement === undefined || hold === undefined) {
    throw new ApiCommandError(
      422,
      eligibility.reasonCodes[0] ?? "PAYMENT_GATE_LOCKED",
      "Payment intent cannot be created for the current booking state."
    );
  }

  const expiresAt = new Date(Math.min(hold.expiresAt.getTime(), now.getTime() + 15 * 60_000));
  const expectation = createMockPaymentExpectation(opaqueId("ref"), agreement.payloadHashSha256);
  const intent = await transaction.paymentIntent.create({
    data: {
      publicId: opaqueId("pi"),
      bookingId: booking.id,
      agreementId: agreement.id,
      status: "CREATED",
      currency: "VND",
      amountMinor: booking.depositAmountMinor ?? 0,
      recipientWallet: expectation.recipient,
      solanaReference: expectation.reference,
      memoReference: expectation.memoReference,
      expiresAt,
      idempotencyKey
    }
  });
  await transitionBookingThrough(
    transaction,
    booking.id,
    booking.status as BookingDraft["status"],
    [BookingStatus.PaymentPending]
  );
  const call = await transaction.callSession.findFirstOrThrow({ where: { bookingId: booking.id } });
  await appendEvent(transaction, {
    callId: call.publicId,
    bookingId,
    event: "payment.intent.created",
    data: {
      paymentIntentId: intent.publicId,
      status: PaymentIntentStatus.Created,
      amount: { currency: "VND", minor: intent.amountMinor },
      reference: intent.solanaReference,
      expiresAt: iso(intent.expiresAt)
    },
    requestId,
    occurredAt: now
  });

  return presentPaymentIntent({
    statusCode: 201,
    bookingId,
    agreementId: agreement.publicId,
    intent
  });
}

export function createPaymentIntentInTransaction(
  client: DatabaseClient,
  bookingId: string,
  idempotencyKey: string,
  requestId: string
): Promise<MockPaymentCreateResult> {
  return client.$transaction((transaction) =>
    createPaymentIntent(transaction, bookingId, idempotencyKey, requestId, new Date())
  );
}
