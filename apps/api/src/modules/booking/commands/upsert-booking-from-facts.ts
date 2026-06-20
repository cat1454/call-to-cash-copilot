import { randomUUID } from "node:crypto";

import { Prisma } from "@call-to-cash/db";
import {
  BookingStatus,
  EventName,
  PaymentGateStatus,
  RISK_POLICY_VERSION,
  RiskNextAction
} from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { reserveInventoryHold } from "./reserve-inventory-hold.js";
import {
  deriveRisk,
  isOperationallyReady,
  latestLockedAgreement,
  loadBookingForRisk,
  transitionBookingThrough
} from "../queries/get-booking-risk-context.js";
import type {
  BookingDraftWriter,
  BookingStatusValue,
  Transaction,
  UpsertBookingFromFactsInput
} from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function iso(value: Date): string {
  return value.toISOString();
}

export async function upsertBookingFromFacts(
  transaction: Transaction,
  input: UpsertBookingFromFactsInput
): Promise<{ id: string; publicId: string; status: string }> {
  const { callSessionId, facts, now } = input;
  const existing = await transaction.booking.findUnique({ where: { callSessionId } });
  const departure =
    facts.routeFrom !== undefined &&
    facts.routeTo !== undefined &&
    facts.departureHint !== undefined
      ? await transaction.tripDeparture.findFirst({
          where: {
            routeFrom: facts.routeFrom,
            routeTo: facts.routeTo,
            operationalStatus: "SCHEDULED",
            departureAtUtc: { gt: now }
          },
          orderBy: { departureAtUtc: "asc" }
        })
      : null;
  const passengerCount = facts.passengerCount ?? existing?.passengerCount ?? null;
  const updateData = {
    ...(facts.routeFrom === undefined ? {} : { routeFrom: facts.routeFrom }),
    ...(facts.routeTo === undefined ? {} : { routeTo: facts.routeTo }),
    ...(facts.pickupPoint === undefined
      ? {}
      : {
          pickupPointDisplay: facts.pickupPoint,
          pickupPointEncrypted: `demo-encrypted:${facts.pickupPoint}`
        }),
    ...(facts.contactPhoneMasked === undefined
      ? {}
      : {
          contactPhoneMasked: facts.contactPhoneMasked,
          contactPhoneEncrypted: "demo-encrypted:[PHONE]"
        }),
    ...(facts.passengerCount === undefined ? {} : { passengerCount: facts.passengerCount }),
    ...(departure === null
      ? {}
      : {
          tripDepartureId: departure.id,
          routeFrom: departure.routeFrom,
          routeTo: departure.routeTo,
          departureAtUtc: departure.departureAtUtc,
          departureTimezone: departure.departureTimezone,
          currency: departure.currency,
          totalAmountMinor:
            passengerCount === null ? null : passengerCount * departure.farePerSeatMinor,
          depositAmountMinor: departure.depositAmountMinor,
          refundPolicyVersion: departure.refundPolicyVersion
        }),
    updatedAt: now
  };
  const booking =
    existing === null
      ? await transaction.booking.create({
          data: {
            publicId: opaqueId("bk"),
            callSessionId,
            status: BookingStatus.Draft,
            currency: "VND",
            ...updateData
          }
        })
      : await transaction.booking.update({
          where: { id: existing.id },
          data: { ...updateData, version: { increment: 1 } }
        });
  if (existing === null) {
    await transaction.callSession.update({
      where: { id: callSessionId },
      data: { bookingId: booking.id }
    });
    const status = await transitionBookingThrough(transaction, booking.id, BookingStatus.Draft, [
      BookingStatus.FieldsPartial
    ]);
    await reserveInventoryHold(transaction, {
      bookingId: booking.id,
      bookingPublicId: booking.publicId,
      departureId: booking.tripDepartureId,
      passengerCount: booking.passengerCount,
      bookingVersion: booking.version,
      requestId: input.requestId,
      now
    });
    return { ...booking, status };
  }
  await reserveInventoryHold(transaction, {
    bookingId: booking.id,
    bookingPublicId: booking.publicId,
    departureId: booking.tripDepartureId,
    passengerCount: booking.passengerCount,
    bookingVersion: booking.version,
    requestId: input.requestId,
    now
  });
  return booking;
}

export const bookingDraftWriter: BookingDraftWriter = { upsertFromFacts: upsertBookingFromFacts };

export async function recomputeBookingRiskAndEvents(
  transaction: Transaction,
  callId: string,
  bookingId: string,
  input: {
    requestId: string;
    occurredAt: Date;
    transcriptTurn?: {
      publicId: string;
      sequenceNo: number;
      speaker: string;
      contentRedacted: string;
      createdAt: Date;
    };
    emitTranscript?: boolean;
  }
): Promise<void> {
  const booking = await loadBookingForRisk(transaction, bookingId);
  const agreementLocked = latestLockedAgreement(booking) !== undefined;
  const risk = deriveRisk(booking, input.occurredAt, {
    refundPolicyConfirmed: agreementLocked,
    explicitConfirmation: agreementLocked,
    agreementLocked
  });
  const currentStatus = booking.status as BookingStatusValue;
  const targets: BookingStatusValue[] = [];
  if (agreementLocked && currentStatus === BookingStatus.AgreementReady)
    targets.push(BookingStatus.AgreementLocked);
  else if (isOperationallyReady(booking, input.occurredAt)) {
    if (currentStatus === BookingStatus.Draft) targets.push(BookingStatus.FieldsPartial);
    if (currentStatus === BookingStatus.Draft || currentStatus === BookingStatus.FieldsPartial)
      targets.push(BookingStatus.BookingDraftReady);
    if (
      currentStatus === BookingStatus.Draft ||
      currentStatus === BookingStatus.FieldsPartial ||
      currentStatus === BookingStatus.BookingDraftReady
    )
      targets.push(BookingStatus.AgreementReady);
  } else if (currentStatus === BookingStatus.Draft) targets.push(BookingStatus.FieldsPartial);
  const status =
    targets.length === 0
      ? currentStatus
      : await transitionBookingThrough(transaction, booking.id, currentStatus, targets);
  const assessment = await transaction.riskAssessment.create({
    data: {
      publicId: opaqueId("risk"),
      callSessionId: (
        await transaction.callSession.findUniqueOrThrow({ where: { publicId: callId } })
      ).id,
      bookingId: booking.id,
      assessmentVersion:
        (await transaction.riskAssessment.count({ where: { bookingId: booking.id } })) + 1,
      policyVersion: RISK_POLICY_VERSION,
      completenessScore: risk.completenessScore,
      disputeRiskScore: risk.disputeRisk,
      paymentReadinessScore: risk.paymentReadiness,
      gateDecision: risk.paymentGate,
      nextAction: risk.nextAction,
      reasonCodes: asJson(risk.reasonCodes),
      evidence: asJson(risk.evidence),
      createdAt: input.occurredAt
    }
  });
  if (input.emitTranscript && input.transcriptTurn !== undefined) {
    await appendEvent(transaction, {
      callId,
      bookingId,
      event: EventName.TranscriptTurnCreated,
      data: {
        turnId: input.transcriptTurn.publicId,
        sequenceNo: input.transcriptTurn.sequenceNo,
        speaker: input.transcriptTurn.speaker,
        content: input.transcriptTurn.contentRedacted,
        isFinal: true,
        timestamp: iso(input.transcriptTurn.createdAt)
      },
      requestId: input.requestId,
      occurredAt: input.occurredAt
    });
  }
  await appendEvent(transaction, {
    callId,
    bookingId,
    event: EventName.BookingUpdated,
    data: {
      status,
      changedFields: ["transcript"],
      agreementInvalidated: false,
      nextAction: RiskNextAction.RenderUpdatedAgreement
    },
    requestId: input.requestId,
    occurredAt: input.occurredAt
  });
  await appendEvent(transaction, {
    callId,
    bookingId,
    event: EventName.RiskScoreUpdated,
    data: {
      assessmentId: assessment.publicId,
      completenessScore: risk.completenessScore,
      disputeRisk: risk.disputeRisk,
      paymentReadiness: risk.paymentReadiness,
      paymentGate: risk.paymentGate,
      nextAction: risk.nextAction,
      missingFields: risk.missingFields,
      reasonCodes: risk.reasonCodes,
      customerMessage: risk.customerMessage
    },
    requestId: input.requestId,
    occurredAt: input.occurredAt
  });
  await appendEvent(transaction, {
    callId,
    bookingId,
    event: EventName.RiskPaymentGateUpdated,
    data: {
      previousDecision: PaymentGateStatus.Locked,
      paymentGate: risk.paymentGate,
      nextAction: risk.nextAction,
      reasonCodes: risk.reasonCodes,
      agreementVersion: latestLockedAgreement(booking)?.version ?? null
    },
    requestId: input.requestId,
    occurredAt: input.occurredAt
  });
}
