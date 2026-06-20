import { randomUUID } from "node:crypto";

import {
  calculateCompleteness,
  calculateDisputeRisk,
  calculatePaymentReadiness,
  evaluatePaymentGate,
  getRequiredNextAction,
  transitionBooking,
  transitionCall,
  validateBookingFields,
  type CriticalBlockerCode,
  type StateTransitionResult
} from "@call-to-cash/domain";
import { InventoryRepository, Prisma, type DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  CallStatus,
  Currency,
  EventName,
  PaymentGateStatus,
  RISK_POLICY_VERSION,
  RiskNextAction,
  type BookingDraft,
  type RiskReasonCode
} from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { customerMessageFor, iso, redactContent } from "../call-session.presenter.js";
import { extractReplayFacts } from "../replay/replay-extractor.js";
import type {
  AppendTranscriptTurnInput,
  BookingForRisk,
  BookingStatusValue,
  CallStatusValue,
  ExtractedFacts,
  ServiceData,
  Transaction
} from "../types.js";

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }

  return result.status;
}

async function transitionBookingThrough(
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

function latestActiveHold(booking: BookingForRisk, now: Date) {
  return booking.inventoryHolds.find(
    (hold) => hold.status === "ACTIVE" && hold.expiresAt.getTime() > now.getTime()
  );
}

function latestLockedAgreement(booking: BookingForRisk) {
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
  const service = {
    vertical: "INTERCITY_BUS" as const,
    ...(booking.routeFrom === null ? {} : { routeFrom: booking.routeFrom }),
    ...(booking.routeTo === null ? {} : { routeTo: booking.routeTo }),
    ...(booking.departureAtUtc === null ? {} : { departureAt: iso(booking.departureAtUtc) }),
    ...(booking.passengerCount === null ? {} : { passengerCount: booking.passengerCount }),
    ...(booking.pickupPointDisplay === null ? {} : { pickupPoint: booking.pickupPointDisplay }),
    ...(hold === undefined
      ? {}
      : {
          inventoryReservationId: hold.publicId,
          inventoryHoldExpiresAt: iso(hold.expiresAt)
        })
  };
  const customer =
    booking.contactPhoneMasked === null ? {} : { contactMasked: booking.contactPhoneMasked };
  const pricing = {
    currency: Currency.Vnd,
    ...(booking.totalAmountMinor === null ? {} : { fareTotalVnd: booking.totalAmountMinor }),
    ...(booking.depositAmountMinor === null
      ? {}
      : { depositAmountVnd: booking.depositAmountMinor }),
    ...(booking.refundPolicyVersion === null
      ? {}
      : { refundPolicyVersion: booking.refundPolicyVersion })
  };

  return {
    bookingId: booking.publicId,
    status: booking.status as BookingDraft["status"],
    service,
    customer,
    pricing,
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

function isOperationallyReady(booking: BookingForRisk, now: Date): boolean {
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

function deriveRisk(
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
  const draft = bookingDraftFromRecord(booking, {
    now,
    refundPolicyConfirmed: input.refundPolicyConfirmed,
    explicitConfirmation: input.explicitConfirmation,
    agreementLocked: input.agreementLocked
  });
  const validation = validateBookingFields({
    booking: draft,
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
  const reasonCodes: RiskReasonCode[] = [
    ...new Set<RiskReasonCode>([...validation.reasonCodes, ...blockerReasonCodes])
  ];

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

async function upsertBookingFromFacts(
  transaction: Transaction,
  callId: string,
  facts: ExtractedFacts,
  now: Date
) {
  const existing = await transaction.booking.findUnique({
    where: { callSessionId: callId }
  });
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

  if (existing !== null) {
    return transaction.booking.update({
      where: { id: existing.id },
      data: { ...updateData, version: { increment: 1 } }
    });
  }

  const booking = await transaction.booking.create({
    data: {
      publicId: opaqueId("bk"),
      callSessionId: callId,
      status: BookingStatus.Draft,
      currency: "VND",
      ...updateData
    }
  });
  await transaction.callSession.update({
    where: { id: callId },
    data: { bookingId: booking.id }
  });

  const status = await transitionBookingThrough(transaction, booking.id, BookingStatus.Draft, [
    BookingStatus.FieldsPartial
  ]);
  return { ...booking, status };
}

async function ensureInventoryHold(
  client: DatabaseClient,
  bookingId: string,
  facts: ExtractedFacts,
  requestId: string,
  now: Date
): Promise<void> {
  if (facts.passengerCount === undefined) {
    return;
  }

  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    include: { inventoryHolds: true }
  });
  if (
    booking === null ||
    booking.tripDepartureId === null ||
    booking.passengerCount === null ||
    booking.inventoryHolds.some(
      (hold) => hold.status === "ACTIVE" && hold.expiresAt.getTime() > now.getTime()
    )
  ) {
    return;
  }

  await new InventoryRepository(client).reserve({
    publicId: opaqueId("hold"),
    idempotencyKey: `hold-${booking.publicId}-v${booking.version}`,
    bookingId: booking.id,
    departureId: booking.tripDepartureId,
    quantity: booking.passengerCount,
    now,
    expiresAt: new Date(now.getTime() + 15 * 60_000),
    requestId
  });
}

async function loadBookingForRisk(transaction: Transaction, publicId: string) {
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

  const inventoryHolds = await transaction.inventoryHold.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      publicId: true,
      status: true,
      quantity: true,
      expiresAt: true
    }
  });
  const agreements = await transaction.agreement.findMany({
    where: { bookingId: booking.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      publicId: true,
      version: true,
      status: true,
      payloadHashSha256: true
    }
  });
  const paymentIntents = await transaction.paymentIntent.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" },
    select: {
      publicId: true,
      status: true
    }
  });

  return { ...booking, inventoryHolds, agreements, paymentIntents } satisfies BookingForRisk;
}

async function recomputeRiskAndEvents(
  client: DatabaseClient,
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
      isFinal: boolean;
      createdAt: Date;
    };
    emitTranscript?: boolean;
  }
) {
  return client.$transaction(async (transaction) => {
    const booking = await loadBookingForRisk(transaction, bookingId);
    const agreementLocked = latestLockedAgreement(booking) !== undefined;
    const risk = deriveRisk(booking, input.occurredAt, {
      refundPolicyConfirmed: agreementLocked,
      explicitConfirmation: agreementLocked,
      agreementLocked
    });
    const currentStatus = booking.status as BookingStatusValue;
    const operationallyReady = isOperationallyReady(booking, input.occurredAt);
    const transitionTargets: BookingStatusValue[] = [];
    if (agreementLocked && currentStatus === BookingStatus.AgreementReady) {
      transitionTargets.push(BookingStatus.AgreementLocked);
    } else if (operationallyReady) {
      if (currentStatus === BookingStatus.Draft) {
        transitionTargets.push(BookingStatus.FieldsPartial);
      }
      if (currentStatus === BookingStatus.Draft || currentStatus === BookingStatus.FieldsPartial) {
        transitionTargets.push(BookingStatus.BookingDraftReady);
      }
      if (
        currentStatus === BookingStatus.Draft ||
        currentStatus === BookingStatus.FieldsPartial ||
        currentStatus === BookingStatus.BookingDraftReady
      ) {
        transitionTargets.push(BookingStatus.AgreementReady);
      }
    } else if (currentStatus === BookingStatus.Draft) {
      transitionTargets.push(BookingStatus.FieldsPartial);
    }
    const nextStatus =
      transitionTargets.length === 0
        ? currentStatus
        : await transitionBookingThrough(transaction, booking.id, currentStatus, transitionTargets);
    const updatedBooking = { ...booking, status: nextStatus };
    const assessmentVersion =
      (await transaction.riskAssessment.count({ where: { bookingId: booking.id } })) + 1;
    const assessment = await transaction.riskAssessment.create({
      data: {
        publicId: opaqueId("risk"),
        callSessionId: (
          await transaction.callSession.findUniqueOrThrow({ where: { publicId: callId } })
        ).id,
        bookingId: booking.id,
        assessmentVersion,
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

    if (input.emitTranscript === true && input.transcriptTurn !== undefined) {
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
        status: updatedBooking.status,
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

    return { risk, assessment };
  });
}

export async function appendTranscriptTurn(
  client: DatabaseClient,
  input: AppendTranscriptTurnInput
): Promise<ServiceData> {
  if (!input.turn.isFinal) {
    throw new ApiCommandError(422, "TRANSCRIPT_NOT_FINAL", "Only final transcript turns persist.");
  }

  const now = new Date();
  const facts = extractReplayFacts(input.turn.content);
  const persisted = await client.$transaction(async (transaction) => {
    const call = await transaction.callSession.findUnique({
      where: { publicId: input.callId }
    });
    if (call === null) {
      throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
    }
    if (["ENDED", "FAILED", "CANCELLED"].includes(call.status)) {
      throw new ApiCommandError(409, "CALL_NOT_ACTIVE", "Call is not accepting transcript turns.");
    }

    const replay = await transaction.transcriptTurn.findUnique({
      where: {
        callSessionId_providerEventId: {
          callSessionId: call.id,
          providerEventId: input.turn.clientTurnId
        }
      }
    });
    if (replay !== null) {
      const replayBooking = await transaction.booking.findUnique({
        where: { callSessionId: call.id }
      });
      if (replayBooking === null) {
        throw new ApiCommandError(
          409,
          "BOOKING_NOT_FOUND",
          "Duplicate transcript turn has no linked booking."
        );
      }
      return {
        call,
        booking: replayBooking,
        turn: replay,
        duplicate: true
      };
    }

    const turn = await transaction.transcriptTurn.create({
      data: {
        publicId: opaqueId("turn"),
        callSessionId: call.id,
        providerEventId: input.turn.clientTurnId,
        sequenceNo: input.turn.sequenceNo,
        speaker: input.turn.speaker,
        contentRedacted: redactContent(input.turn.content),
        language: input.turn.language,
        isFinal: input.turn.isFinal,
        ...(input.turn.sttConfidence === undefined
          ? {}
          : { sttConfidence: input.turn.sttConfidence }),
        startedAt: input.turn.startedAt === undefined ? null : new Date(input.turn.startedAt),
        endedAt: input.turn.endedAt === undefined ? null : new Date(input.turn.endedAt),
        source: input.turn.source,
        createdAt: now
      }
    });
    const activeCall =
      call.status === CallStatus.Created
        ? await transaction.callSession.update({
            where: { id: call.id },
            data: {
              status: requireTransition(
                transitionCall(call.status as CallStatusValue, CallStatus.Active),
                "Call cannot become active from its current state."
              ),
              startedAt: call.startedAt ?? now
            }
          })
        : call;
    const booking = await upsertBookingFromFacts(transaction, activeCall.id, facts, now);

    await transaction.bookingExtraction.create({
      data: {
        publicId: opaqueId("ext"),
        callSessionId: activeCall.id,
        sourceTurnFrom: input.turn.sequenceNo,
        sourceTurnTo: input.turn.sequenceNo,
        extractionVersion: "deterministic-replay-v1",
        payload: asJson({
          routeFrom: facts.routeFrom,
          routeTo: facts.routeTo,
          passengerCount: facts.passengerCount,
          pickupPoint: facts.pickupPoint,
          contactMasked: facts.contactPhoneMasked
        }),
        fieldConfidence: asJson({ deterministic: 1 }),
        missingFields: asJson([]),
        contradictions: asJson([]),
        status: "ACCEPTED"
      }
    });

    return { call: activeCall, booking, turn, duplicate: false };
  });

  await ensureInventoryHold(client, persisted.booking.id, facts, input.requestId, now);
  await recomputeRiskAndEvents(client, persisted.call.publicId, persisted.booking.publicId, {
    requestId: input.requestId,
    occurredAt: now,
    transcriptTurn: persisted.turn,
    emitTranscript: !persisted.duplicate
  });

  return {
    turnId: persisted.turn.publicId,
    callId: input.callId,
    accepted: true as const,
    analysisQueued: false
  };
}
