import { createHash, randomUUID } from "node:crypto";

import { serializeCanonicalAgreement } from "@call-to-cash/domain";
import { Prisma } from "@call-to-cash/db";
import {
  AGREEMENT_CANONICALIZATION_VERSION,
  AgreementStatus,
  ConfirmationMethod,
  Currency,
  type Agreement
} from "@call-to-cash/shared";

import type { Transaction } from "../types.js";
import type { BookingForRisk } from "../types.js";

const REFUND_POLICY_SUMMARY =
  "Cancellation at least 12 hours before departure: refund 80% of the deposit. Cancellation less than 12 hours before departure: deposit is non-refundable.";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createLockedAgreement(
  transaction: Transaction,
  input: {
    booking: BookingForRisk;
    bookingId: string;
    agreementVersion: number;
    confirmation: {
      method: (typeof ConfirmationMethod)[keyof typeof ConfirmationMethod];
      confirmedTurnId?: string | undefined;
      text?: string | undefined;
    };
    hold: NonNullable<BookingForRisk["inventoryHolds"][number] | undefined>;
    now: Date;
  }
): Promise<{ publicId: string; version: number; payloadHashSha256: string }> {
  const { booking, hold } = input;
  if (
    booking.routeFrom === null ||
    booking.routeTo === null ||
    booking.departureAtUtc === null ||
    booking.passengerCount === null ||
    booking.pickupPointDisplay === null ||
    booking.totalAmountMinor === null ||
    booking.depositAmountMinor === null ||
    booking.refundPolicyVersion === null ||
    booking.contactPhoneMasked === null
  ) {
    throw new Error("Locked agreements require complete booking terms.");
  }
  const publicId = opaqueId("agr");
  const agreementShape: Agreement = {
    agreementId: publicId,
    bookingId: input.bookingId,
    version: input.agreementVersion,
    status: AgreementStatus.Locked,
    service: {
      routeFrom: booking.routeFrom,
      routeTo: booking.routeTo,
      departureAt: iso(booking.departureAtUtc),
      passengerCount: booking.passengerCount,
      pickupPoint: booking.pickupPointDisplay,
      inventoryReservationId: hold.publicId,
      holdExpiresAt: iso(hold.expiresAt)
    },
    commercialTerms: {
      fareTotalVnd: booking.totalAmountMinor,
      depositAmountVnd: booking.depositAmountMinor,
      currency: Currency.Vnd,
      refundPolicyVersion: booking.refundPolicyVersion,
      refundPolicySummary: REFUND_POLICY_SUMMARY
    },
    customerAcknowledgement: {
      contactMasked: booking.contactPhoneMasked,
      explicitConfirmationAt: iso(input.now),
      confirmationMethod: input.confirmation
        .method as Agreement["customerAcknowledgement"]["confirmationMethod"]
    },
    canonicalizationVersion: AGREEMENT_CANONICALIZATION_VERSION,
    createdAt: iso(input.now)
  };
  const canonical = serializeCanonicalAgreement(agreementShape);
  const confirmedTurn =
    input.confirmation.confirmedTurnId === undefined
      ? null
      : await transaction.transcriptTurn.findUnique({
          where: { publicId: input.confirmation.confirmedTurnId }
        });
  const agreement = await transaction.agreement.create({
    data: {
      publicId,
      bookingId: booking.id,
      inventoryHoldId: hold.id,
      version: input.agreementVersion,
      status: "LOCKED",
      canonicalPayload: JSON.parse(canonical) as Prisma.InputJsonValue,
      payloadHashSha256: sha256(canonical),
      policyVersion: booking.refundPolicyVersion,
      explicitConfirmationMethod: input.confirmation.method,
      confirmedTurnId: confirmedTurn?.id ?? null,
      confirmedAt: input.now,
      createdAt: input.now
    }
  });
  return agreement;
}
