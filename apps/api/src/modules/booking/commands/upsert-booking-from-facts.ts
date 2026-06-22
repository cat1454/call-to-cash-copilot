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

function departureParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function matchesDeparture(
  departureAtUtc: Date,
  facts: UpsertBookingFromFactsInput["facts"]
): boolean {
  const local = departureParts(departureAtUtc);
  const [hour, minute] = facts.departureLocalTime?.split(":").map(Number) ?? [];
  return (
    (facts.departureDay === undefined || local.day === facts.departureDay) &&
    (facts.departureMonth === undefined || local.month === facts.departureMonth) &&
    (hour === undefined || (local.hour === hour && local.minute === minute))
  );
}

export function resolveDepartureRoute(
  facts: UpsertBookingFromFactsInput["facts"],
  existing: { routeFrom: string | null; routeTo: string | null } | null
): { routeFrom?: string; routeTo?: string } {
  const routeFrom = facts.routeFrom ?? existing?.routeFrom ?? undefined;
  const routeTo = facts.routeTo ?? existing?.routeTo ?? undefined;
  return {
    ...(routeFrom === undefined ? {} : { routeFrom }),
    ...(routeTo === undefined ? {} : { routeTo })
  };
}

export async function upsertBookingFromFacts(
  transaction: Transaction,
  input: UpsertBookingFromFactsInput
): Promise<{
  id: string;
  publicId: string;
  status: string;
  created: boolean;
  changedFields: string[];
}> {
  const { callSessionId, facts, now } = input;
  const existing = await transaction.booking.findUnique({ where: { callSessionId } });
  const departureRoute = resolveDepartureRoute(facts, existing);
  const hasDepartureHint =
    facts.departureLocalTime !== undefined || facts.departureDay !== undefined;
  const departureCandidates =
    departureRoute.routeFrom !== undefined &&
    departureRoute.routeTo !== undefined &&
    hasDepartureHint
      ? await transaction.tripDeparture.findMany({
          where: {
            routeFrom: departureRoute.routeFrom,
            routeTo: departureRoute.routeTo,
            operationalStatus: "SCHEDULED",
            departureAtUtc: { gt: now }
          },
          orderBy: { departureAtUtc: "asc" }
        })
      : [];
  const exactDepartures = departureCandidates.filter((candidate) =>
    matchesDeparture(candidate.departureAtUtc, facts)
  );
  const departure =
    exactDepartures.length === 1 || facts.departureLocalTime !== undefined
      ? (exactDepartures[0] ?? null)
      : null;
  const passengerCount = facts.passengerCount ?? existing?.passengerCount ?? null;
  const existingDeparture =
    departure === null &&
    existing !== null &&
    existing.tripDepartureId !== null &&
    facts.passengerCount !== undefined
      ? await transaction.tripDeparture.findUnique({ where: { id: existing.tripDepartureId } })
      : null;
  const pricingDeparture = departure ?? existingDeparture;
  const changedFields = new Set<string>();
  const noteChange = (field: string, next: unknown, current: unknown) => {
    if (next !== undefined && next !== current) changedFields.add(field);
  };
  noteChange("routeFrom", facts.routeFrom, existing?.routeFrom);
  noteChange("routeTo", facts.routeTo, existing?.routeTo);
  noteChange("pickupPoint", facts.pickupPoint, existing?.pickupPointDisplay);
  noteChange("contactPhoneMasked", facts.contactPhoneMasked, existing?.contactPhoneMasked);
  noteChange("passengerCount", facts.passengerCount, existing?.passengerCount);
  if (departure !== null && departure.id !== existing?.tripDepartureId) {
    for (const field of [
      "departureAt",
      "fareTotalVnd",
      "depositAmountVnd",
      "refundPolicyVersion"
    ]) {
      changedFields.add(field);
    }
  }
  const totalAmountMinor =
    pricingDeparture === null || passengerCount === null
      ? null
      : passengerCount * pricingDeparture.farePerSeatMinor;
  noteChange("fareTotalVnd", totalAmountMinor, existing?.totalAmountMinor);
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
          depositAmountMinor: departure.depositAmountMinor,
          refundPolicyVersion: departure.refundPolicyVersion
        }),
    ...(totalAmountMinor === null ? {} : { totalAmountMinor }),
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
    return { ...booking, status, created: true, changedFields: [...changedFields] };
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
  return { ...booking, created: false, changedFields: [...changedFields] };
}

export const bookingDraftWriter: BookingDraftWriter = { upsertFromFacts: upsertBookingFromFacts };

export async function recomputeBookingRiskAndEvents(
  transaction: Transaction,
  callId: string,
  bookingId: string,
  input: {
    requestId: string;
    occurredAt: Date;
    bookingCreated?: boolean;
    changedFields?: string[];
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
  if (input.bookingCreated) {
    await appendEvent(transaction, {
      callId,
      bookingId,
      event: EventName.BookingCreated,
      data: {
        status: BookingStatus.Draft,
        bookingId
      },
      requestId: input.requestId,
      occurredAt: input.occurredAt
    });
  }
  if ((input.changedFields?.length ?? 0) > 0) {
    await appendEvent(transaction, {
      callId,
      bookingId,
      event: EventName.BookingUpdated,
      data: {
        status,
        changedFields: input.changedFields,
        agreementInvalidated: false,
        nextAction: RiskNextAction.RenderUpdatedAgreement
      },
      requestId: input.requestId,
      occurredAt: input.occurredAt
    });
  }
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
