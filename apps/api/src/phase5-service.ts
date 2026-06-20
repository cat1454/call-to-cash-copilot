import { createHash, randomUUID } from "node:crypto";

import {
  canCreatePaymentIntent,
  calculateCompleteness,
  calculateDisputeRisk,
  calculatePaymentReadiness,
  evaluatePaymentGate,
  getRequiredNextAction,
  serializeCanonicalAgreement,
  transitionBooking,
  transitionPaymentIntent,
  transitionReceipt,
  validateBookingFields
} from "@call-to-cash/domain";
import type { StateTransitionResult } from "@call-to-cash/domain";
import { Prisma, type DatabaseClient } from "@call-to-cash/db";
import {
  AGREEMENT_CANONICALIZATION_VERSION,
  AgreementStatus,
  BookingStatus,
  ConfirmationMethod,
  Currency,
  EventEnvelopeSchema,
  EventName,
  PaymentAnchorType,
  PaymentGateStatus,
  PaymentIntentStatus,
  ProofStatus,
  RISK_POLICY_VERSION,
  ReceiptStatus,
  RiskNextAction,
  type Agreement,
  type BookingDraft,
  type ErrorCode,
  type EnumValue,
  type EventEnvelope,
  type RiskReasonCode,
  type SimulatePaymentFailureRequest
} from "@call-to-cash/shared";
import type { CriticalBlockerCode } from "@call-to-cash/domain";
import { ApiCommandError } from "./platform/http/api-command-error.js";

type Transaction = Prisma.TransactionClient;
type BookingStatusValue = EnumValue<typeof BookingStatus>;
type PaymentIntentStatusValue = EnumValue<typeof PaymentIntentStatus>;
type ReceiptStatusValue = EnumValue<typeof ReceiptStatus>;

type ExtractedFacts = {
  routeFrom?: string;
  routeTo?: string;
  passengerCount?: number;
  pickupPoint?: string;
  contactPhoneMasked?: string;
  departureHint?: "22:30";
};

type ServiceData = Record<string, unknown>;

type MockPaymentCreateResult = {
  statusCode: number;
  data: ServiceData;
};

type BookingForRisk = {
  id: string;
  publicId: string;
  status: string;
  routeFrom: string | null;
  routeTo: string | null;
  departureAtUtc: Date | null;
  departureTimezone: string;
  passengerCount: number | null;
  pickupPointDisplay: string | null;
  contactPhoneMasked: string | null;
  totalAmountMinor: number | null;
  depositAmountMinor: number | null;
  refundPolicyVersion: string | null;
  inventoryHolds: Array<{
    id: string;
    publicId: string;
    status: string;
    quantity: number;
    expiresAt: Date;
  }>;
  agreements: Array<{
    id: string;
    publicId: string;
    version: number;
    status: string;
    payloadHashSha256: string;
  }>;
  paymentIntents: Array<{
    publicId: string;
    status: string;
  }>;
};

const REFUND_POLICY_SUMMARY =
  "Cancellation at least 12 hours before departure: refund 80% of the deposit. Cancellation less than 12 hours before departure: deposit is non-refundable.";

const MOCK_RECIPIENT = "mock-recipient-wallet";
const ACTIVE_PAYMENT_STATUSES = ["CREATED", "PENDING", "FAILED"] as const;

function requireTransition<S extends string>(result: StateTransitionResult<S>, message: string): S {
  if (!result.ok) {
    throw new ApiCommandError(409, result.errorCode, message);
  }

  return result.status;
}

function opaqueId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/gu, "");
  if (digits.length < 7) {
    return "[PHONE]";
  }

  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

export function redactContent(content: string): string {
  return content.replace(/\b0\d{8,10}\b/gu, (phone) => maskPhone(phone));
}

export function extractFacts(content: string): ExtractedFacts {
  const normalized = normalizeForSearch(content);
  const phone = content.match(/\b0\d{8,10}\b/u)?.[0];
  const passengerCount =
    normalized.match(/(\d+)\s*(ve|khach|nguoi|cho)/u)?.[1] ??
    normalized
      .match(/\b\d{1,2}\b/gu)
      ?.map(Number)
      .find((value) => value > 0 && value <= 36)
      ?.toString();
  const mentionsSapa = /sa\s*pa|sapa/u.test(normalized);
  const mentionsMyDinh =
    normalized.includes("my dinh") ||
    normalized.includes("m? ??nh") ||
    (normalized.includes("m") && normalized.includes("nh") && normalized.includes("?"));

  return {
    ...(normalized.includes("ha noi") || normalized.includes("hanoi") || mentionsSapa
      ? { routeFrom: "Ha Noi" }
      : {}),
    ...(mentionsSapa ? { routeTo: "Sa Pa" } : {}),
    ...(passengerCount !== undefined ? { passengerCount: Number(passengerCount) } : {}),
    ...(mentionsMyDinh ? { pickupPoint: "My Dinh" } : {}),
    ...(phone !== undefined ? { contactPhoneMasked: maskPhone(phone) } : {}),
    ...(/22[:h ]?30/u.test(normalized) ? { departureHint: "22:30" as const } : {})
  };
}

function eventActionName(event: string): string {
  return `EVENT_${event.toUpperCase().replaceAll(".", "_")}`;
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

async function appendEvent(
  transaction: Transaction,
  input: {
    callId: string;
    bookingId?: string | null;
    event: string;
    data: unknown;
    requestId: string;
    occurredAt: Date;
  }
): Promise<EventEnvelope> {
  await transaction.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${input.callId}))
  `);
  const existingEvents = await transaction.auditLog.count({
    where: {
      aggregateType: "CALL_STREAM",
      aggregateId: input.callId,
      eventId: { not: null }
    }
  });
  const envelope = EventEnvelopeSchema.parse({
    eventId: opaqueId("evt"),
    event: input.event,
    version: 1,
    occurredAt: iso(input.occurredAt),
    correlationId: input.requestId,
    callId: input.callId,
    bookingId: input.bookingId ?? null,
    sequence: existingEvents + 1,
    data: input.data
  });

  await transaction.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: eventActionName(input.event),
      aggregateType: "CALL_STREAM",
      aggregateId: input.callId,
      requestId: input.requestId,
      eventId: envelope.eventId,
      afterState: envelope as Prisma.InputJsonValue,
      metadata: { event: input.event },
      createdAt: input.occurredAt
    }
  });

  return envelope;
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

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function shortSignature(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export class Phase5ReplayService {
  constructor(private readonly client: DatabaseClient) {}

  private async loadBookingForRisk(transaction: Transaction, publicId: string) {
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

  async getBooking(bookingId: string): Promise<ServiceData> {
    const booking = await this.client.booking.findUnique({
      where: { publicId: bookingId },
      include: {
        agreements: { orderBy: { version: "desc" }, take: 1 },
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (booking === null) {
      throw new ApiCommandError(404, "BOOKING_NOT_FOUND", "Booking was not found.");
    }

    return {
      bookingId: booking.publicId,
      status: booking.status,
      routeFrom: booking.routeFrom,
      routeTo: booking.routeTo,
      departureAt: booking.departureAtUtc === null ? null : iso(booking.departureAtUtc),
      passengerCount: booking.passengerCount,
      pickupPoint: booking.pickupPointDisplay,
      contactPhoneMasked: booking.contactPhoneMasked,
      fareTotalVnd: booking.totalAmountMinor,
      depositAmountVnd: booking.depositAmountMinor,
      refundPolicyVersion: booking.refundPolicyVersion,
      agreementVersion: booking.agreements[0]?.version ?? null,
      paymentGate: booking.riskAssessments[0]?.gateDecision ?? PaymentGateStatus.Locked
    };
  }

  async confirmBooking(
    bookingId: string,
    input: {
      agreementVersion: number;
      confirmation: {
        method: (typeof ConfirmationMethod)[keyof typeof ConfirmationMethod];
        confirmedTurnId?: string | undefined;
        text?: string | undefined;
      };
    },
    idempotencyKey: string,
    requestId: string
  ): Promise<ServiceData> {
    const now = new Date();
    const idempotencyKeyHash = sha256(idempotencyKey);
    const requestFingerprint = sha256(JSON.stringify({ bookingId, ...input }));
    return this.client.$transaction(async (transaction) => {
      const confirmationReplay = await transaction.auditLog.findFirst({
        where: {
          action: "AGREEMENT_CONFIRMED",
          metadata: {
            path: ["idempotencyKeyHash"],
            equals: idempotencyKeyHash
          }
        }
      });
      const replayMetadata = confirmationReplay?.metadata as {
        requestFingerprint?: string;
      } | null;
      if (
        confirmationReplay !== null &&
        confirmationReplay !== undefined &&
        (confirmationReplay.aggregateId !== bookingId ||
          replayMetadata?.requestFingerprint !== requestFingerprint)
      ) {
        throw new ApiCommandError(
          409,
          "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
          "Idempotency key was already used with another booking confirmation payload."
        );
      }

      const booking = await this.loadBookingForRisk(transaction, bookingId);
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
      const expectedAgreementVersion = (booking.agreements[0]?.version ?? 0) + 1;
      if (input.agreementVersion !== expectedAgreementVersion) {
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

      const agreementPublicId = opaqueId("agr");
      const agreementShape: Agreement = {
        agreementId: agreementPublicId,
        bookingId,
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
          explicitConfirmationAt: iso(now),
          confirmationMethod: input.confirmation
            .method as Agreement["customerAcknowledgement"]["confirmationMethod"]
        },
        canonicalizationVersion: AGREEMENT_CANONICALIZATION_VERSION,
        createdAt: iso(now)
      };
      const canonical = serializeCanonicalAgreement(agreementShape);
      const hash = sha256(canonical);
      const confirmedTurn =
        input.confirmation.confirmedTurnId === undefined
          ? null
          : await transaction.transcriptTurn.findUnique({
              where: { publicId: input.confirmation.confirmedTurnId }
            });
      const agreement = await transaction.agreement.create({
        data: {
          publicId: agreementPublicId,
          bookingId: booking.id,
          inventoryHoldId: hold.id,
          version: input.agreementVersion,
          status: "LOCKED",
          canonicalPayload: asJson(JSON.parse(canonical)),
          payloadHashSha256: hash,
          policyVersion: booking.refundPolicyVersion,
          explicitConfirmationMethod: input.confirmation.method,
          confirmedTurnId: confirmedTurn?.id ?? null,
          confirmedAt: now,
          createdAt: now
        }
      });
      await transitionBookingThrough(
        transaction,
        booking.id,
        booking.status as BookingStatusValue,
        [BookingStatus.AgreementLocked]
      );
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
      await appendEvent(transaction, {
        callId: (
          await transaction.callSession.findFirstOrThrow({ where: { bookingId: booking.id } })
        ).publicId,
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
      await this.recomputeRiskAndEventsInTransaction(transaction, booking.publicId, requestId, now);

      return {
        bookingId,
        status: BookingStatus.AgreementLocked,
        agreement: {
          agreementId: agreement.publicId,
          version: agreement.version,
          sha256Hash: hash
        },
        paymentGate: PaymentGateStatus.Unlocked
      };
    });
  }

  private async recomputeRiskAndEventsInTransaction(
    transaction: Transaction,
    bookingId: string,
    requestId: string,
    now: Date
  ): Promise<void> {
    const booking = await this.loadBookingForRisk(transaction, bookingId);
    const call = await transaction.callSession.findFirstOrThrow({
      where: { bookingId: booking.id }
    });
    const risk = deriveRisk(booking, now, {
      refundPolicyConfirmed: true,
      explicitConfirmation: true,
      agreementLocked: true
    });
    const assessmentVersion =
      (await transaction.riskAssessment.count({ where: { bookingId: booking.id } })) + 1;
    const assessment = await transaction.riskAssessment.create({
      data: {
        publicId: opaqueId("risk"),
        callSessionId: call.id,
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
        createdAt: now
      }
    });
    await appendEvent(transaction, {
      callId: call.publicId,
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
      requestId,
      occurredAt: now
    });
    await appendEvent(transaction, {
      callId: call.publicId,
      bookingId,
      event: EventName.RiskPaymentGateUpdated,
      data: {
        previousDecision: PaymentGateStatus.Locked,
        paymentGate: risk.paymentGate,
        nextAction: risk.nextAction,
        reasonCodes: risk.reasonCodes,
        agreementVersion: latestLockedAgreement(booking)?.version ?? null
      },
      requestId,
      occurredAt: now
    });
  }

  async createMockPaymentIntent(
    bookingId: string,
    idempotencyKey: string,
    requestId: string
  ): Promise<MockPaymentCreateResult> {
    const now = new Date();
    const result = await this.client.$transaction(async (transaction) => {
      const existingForKey = await transaction.paymentIntent.findUnique({
        where: { idempotencyKey }
      });
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
        return { intent: existingForKey, replay: true };
      }
      const booking = await this.loadBookingForRisk(transaction, bookingId);
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
      const intent = await transaction.paymentIntent.create({
        data: {
          publicId: opaqueId("pi"),
          bookingId: booking.id,
          agreementId: agreement.id,
          status: "CREATED",
          currency: "VND",
          amountMinor: booking.depositAmountMinor ?? 0,
          recipientWallet: MOCK_RECIPIENT,
          solanaReference: opaqueId("ref"),
          memoReference: `mock:${agreement.payloadHashSha256}`,
          expiresAt,
          idempotencyKey
        }
      });
      await transitionBookingThrough(
        transaction,
        booking.id,
        booking.status as BookingStatusValue,
        [BookingStatus.PaymentPending]
      );
      const call = await transaction.callSession.findFirstOrThrow({
        where: { bookingId: booking.id }
      });
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId,
        event: EventName.PaymentIntentCreated,
        data: {
          paymentIntentId: intent.publicId,
          status: PaymentIntentStatus.Created,
          amount: { currency: Currency.Vnd, minor: intent.amountMinor },
          reference: intent.solanaReference,
          expiresAt: iso(intent.expiresAt)
        },
        requestId,
        occurredAt: now
      });

      return { intent, replay: false };
    });

    return {
      statusCode: result.replay ? 200 : 201,
      data: {
        paymentIntentId: result.intent.publicId,
        bookingId,
        agreementId: await this.getAgreementPublicId(result.intent.agreementId),
        status: PaymentIntentStatus.Created,
        amount: { currency: Currency.Vnd, minor: result.intent.amountMinor },
        recipient: result.intent.recipientWallet,
        reference: result.intent.solanaReference,
        expiresAt: iso(result.intent.expiresAt),
        idempotencyKey: result.intent.idempotencyKey
      }
    };
  }

  private async getAgreementPublicId(id: string): Promise<string> {
    const agreement = await this.client.agreement.findUniqueOrThrow({ where: { id } });
    return agreement.publicId;
  }

  async verifyMockPayment(
    input: {
      paymentIntentId: string;
      observedAmount: { currency: string; minor: number };
      observedRecipient: string;
      observedReference: string;
      transactionSignature?: string | undefined;
    },
    idempotencyKey: string,
    requestId: string
  ): Promise<ServiceData> {
    const now = new Date();
    const idempotencyKeyHash = sha256(idempotencyKey);
    const requestFingerprint = sha256(
      JSON.stringify({
        paymentIntentId: input.paymentIntentId,
        observedAmount: input.observedAmount,
        observedRecipient: input.observedRecipient,
        observedReference: input.observedReference,
        transactionSignature: input.transactionSignature ?? null
      })
    );
    const result = await this.client.$transaction(async (transaction) => {
      const replay = await transaction.paymentTransaction.findFirst({
        where: {
          rawChainMetadata: {
            path: ["idempotencyKeyHash"],
            equals: idempotencyKeyHash
          }
        }
      });
      if (replay !== null) {
        const replayIntent = await transaction.paymentIntent.findUniqueOrThrow({
          where: { id: replay.paymentIntentId }
        });
        const replayBooking = await transaction.booking.findUniqueOrThrow({
          where: { id: replayIntent.bookingId },
          select: { publicId: true }
        });
        const replayReceipt = await transaction.trustReceipt.findUnique({
          where: { paymentIntentId: replayIntent.id }
        });
        const replayProof = await transaction.proofRecord.findUnique({
          where: { paymentTransactionId: replay.id }
        });
        const replayMetadata = replay.rawChainMetadata as {
          requestFingerprint?: string;
        } | null;
        if (
          replayIntent.publicId !== input.paymentIntentId ||
          replayMetadata?.requestFingerprint !== requestFingerprint
        ) {
          throw new ApiCommandError(
            409,
            "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
            "Idempotency key was already used with another verification payload."
          );
        }
        if (
          replay.verificationStatus === "CONFIRMED" &&
          replayReceipt !== null &&
          replayProof !== null
        ) {
          return {
            data: {
              paymentIntentId: replayIntent.publicId,
              bookingId: replayBooking.publicId,
              status: PaymentIntentStatus.Confirmed,
              transactionSignature: replay.txSignature,
              proofId: replayProof.publicId,
              receiptId: replayReceipt.publicId
            }
          };
        }
        if (replay.verificationStatus === "REJECTED") {
          return {
            error: {
              statusCode: 422,
              code: (replay.rejectionReasonCode ?? "PAYMENT_VERIFICATION_FAILED") as ErrorCode,
              message: "Payment verification failed closed."
            }
          };
        }
      }

      const intent = await transaction.paymentIntent.findUnique({
        where: { publicId: input.paymentIntentId }
      });
      if (intent === null) {
        throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
      }
      const intentBooking = await transaction.booking.findUniqueOrThrow({
        where: { id: intent.bookingId }
      });
      const intentAgreement = await transaction.agreement.findUniqueOrThrow({
        where: { id: intent.agreementId }
      });
      const intentTransactions = await transaction.paymentTransaction.findMany({
        where: { paymentIntentId: intent.id },
        orderBy: { createdAt: "asc" }
      });
      const intentReceipt = await transaction.trustReceipt.findUnique({
        where: { paymentIntentId: intent.id }
      });
      if (intent.status === "CONFIRMED" && intentReceipt !== null) {
        return {
          data: {
            paymentIntentId: intent.publicId,
            bookingId: intentBooking.publicId,
            status: PaymentIntentStatus.Confirmed,
            transactionSignature: intentTransactions[0]?.txSignature ?? "mock_tx_confirmed",
            proofId: (
              await transaction.proofRecord.findFirstOrThrow({
                where: { bookingId: intent.bookingId, agreementId: intent.agreementId }
              })
            ).publicId,
            receiptId: intentReceipt.publicId
          }
        };
      }
      // Phase 7: expiry check — block verify before any state write
      if (intent.expiresAt !== null && intent.expiresAt.getTime() < now.getTime()) {
        throw new ApiCommandError(
          410,
          "PAYMENT_INTENT_EXPIRED",
          "Payment intent has expired. Create a new payment intent after confirming valid booking terms."
        );
      }

      const pendingIntentStatus = requireTransition(
        transitionPaymentIntent(
          intent.status as PaymentIntentStatusValue,
          PaymentIntentStatus.Pending
        ),
        "Payment intent cannot enter verification from its current state."
      );
      if (intent.status !== pendingIntentStatus) {
        await transaction.paymentIntent.update({
          where: { id: intent.id },
          data: { status: pendingIntentStatus }
        });
      }

      const mismatchCode =
        input.observedAmount.minor !== intent.amountMinor
          ? "PAYMENT_AMOUNT_MISMATCH"
          : input.observedRecipient !== intent.recipientWallet
            ? "PAYMENT_RECIPIENT_MISMATCH"
            : input.observedReference !== intent.solanaReference
              ? "PAYMENT_REFERENCE_MISMATCH"
              : null;
      const signature = input.transactionSignature ?? opaqueId("mock_tx");
      const call = await transaction.callSession.findFirstOrThrow({
        where: { bookingId: intent.bookingId }
      });

      if (mismatchCode !== null) {
        await transaction.paymentTransaction.create({
          data: {
            paymentIntentId: intent.id,
            chain: "MOCK",
            txSignature: signature,
            observedAmountMinor: input.observedAmount.minor,
            observedRecipientWallet: input.observedRecipient,
            observedReference: input.observedReference,
            verificationStatus: "REJECTED",
            rejectionReasonCode: mismatchCode,
            verifiedAt: now,
            rawChainMetadata: {
              simulated: true,
              idempotencyKeyHash,
              requestFingerprint
            }
          }
        });
        await transaction.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: requireTransition(
              transitionPaymentIntent(pendingIntentStatus, PaymentIntentStatus.Rejected),
              "Payment intent cannot be rejected from its current state."
            )
          }
        });
        await transitionBookingThrough(
          transaction,
          intent.bookingId,
          intentBooking.status as BookingStatusValue,
          [BookingStatus.ManualReviewRequired]
        );
        await appendEvent(transaction, {
          callId: call.publicId,
          bookingId: intentBooking.publicId,
          event: EventName.PaymentFailed,
          data: {
            paymentIntentId: intent.publicId,
            status: PaymentIntentStatus.Rejected,
            errorCode: mismatchCode,
            retryable: false,
            customerMessage: "Payment did not match the locked agreement."
          },
          requestId,
          occurredAt: now
        });
        return {
          error: {
            statusCode: 422,
            code: mismatchCode as ErrorCode,
            message: "Payment verification failed closed."
          }
        };
      }

      const transactionRecord = await transaction.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          chain: "MOCK",
          txSignature: signature,
          observedAmountMinor: input.observedAmount.minor,
          observedRecipientWallet: input.observedRecipient,
          observedReference: input.observedReference,
          verificationStatus: "CONFIRMED",
          verifiedAt: now,
          rawChainMetadata: {
            simulated: true,
            idempotencyKeyHash,
            requestFingerprint
          }
        }
      });
      await transaction.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: requireTransition(
            transitionPaymentIntent(pendingIntentStatus, PaymentIntentStatus.Confirmed),
            "Payment intent cannot be confirmed from its current state."
          )
        }
      });
      await transaction.inventoryHold.updateMany({
        where: { bookingId: intent.bookingId, status: "ACTIVE" },
        data: { status: "CONSUMED", consumedAt: now }
      });
      await transitionBookingThrough(
        transaction,
        intent.bookingId,
        intentBooking.status as BookingStatusValue,
        [
          BookingStatus.PaymentConfirmed,
          BookingStatus.BookingConfirmed,
          BookingStatus.ReceiptIssued
        ]
      );
      const pendingProof = await transaction.proofRecord.create({
        data: {
          publicId: opaqueId("proof"),
          bookingId: intent.bookingId,
          agreementId: intent.agreementId,
          paymentTransactionId: transactionRecord.id,
          proofHashSha256: intentAgreement.payloadHashSha256,
          anchorType: PaymentAnchorType.ServerAttestation,
          anchorValue: intent.solanaReference,
          verificationStatus: ProofStatus.Pending
        }
      });
      const proof = await transaction.proofRecord.update({
        where: { id: pendingProof.id },
        data: { verificationStatus: ProofStatus.Match, verifiedAt: now }
      });
      const receipt = await transaction.trustReceipt.create({
        data: {
          publicId: opaqueId("rcpt"),
          bookingId: intent.bookingId,
          paymentIntentId: intent.id,
          proofRecordId: proof.id,
          status: ReceiptStatus.Issued,
          receiptPayload: asJson({
            bookingId: intentBooking.publicId,
            route: `${intentBooking.routeFrom} → ${intentBooking.routeTo}`,
            contactPhoneMasked: intentBooking.contactPhoneMasked,
            deposit: intent.amountMinor,
            agreementVersion: intentAgreement.version
          }),
          issuedAt: now,
          verifiedAt: now
        }
      });
      const verifiedReceiptStatus = requireTransition(
        transitionReceipt(ReceiptStatus.Issued, ReceiptStatus.VerifiedMatch),
        "Receipt cannot be verified from its current state."
      );
      await transaction.trustReceipt.update({
        where: { id: receipt.id },
        data: { status: verifiedReceiptStatus }
      });
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId: intentBooking.publicId,
        event: EventName.PaymentConfirmed,
        data: {
          paymentIntentId: intent.publicId,
          status: PaymentIntentStatus.Confirmed,
          transactionSignatureShort: shortSignature(signature),
          verifiedAt: iso(now),
          nextAction: RiskNextAction.IssueReceipt
        },
        requestId,
        occurredAt: now
      });
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId: intentBooking.publicId,
        event: EventName.ReceiptCreated,
        data: {
          receiptId: receipt.publicId,
          status: ReceiptStatus.Issued,
          verification: ProofStatus.Pending
        },
        requestId,
        occurredAt: now
      });
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId: intentBooking.publicId,
        event: EventName.ReceiptVerified,
        data: {
          receiptId: receipt.publicId,
          status: ReceiptStatus.VerifiedMatch,
          verification: ProofStatus.Match,
          agreementVersion: intentAgreement.version,
          verifiedAt: iso(now)
        },
        requestId,
        occurredAt: now
      });

      return {
        data: {
          paymentIntentId: intent.publicId,
          bookingId: intentBooking.publicId,
          status: PaymentIntentStatus.Confirmed,
          transactionSignature: signature,
          proofId: proof.publicId,
          receiptId: receipt.publicId
        }
      };
    });

    if ("error" in result) {
      throw new ApiCommandError(result.error.statusCode, result.error.code, result.error.message);
    }

    return result.data;
  }

  async getPaymentStatus(bookingId: string): Promise<ServiceData> {
    const intent = await this.client.paymentIntent.findFirst({
      where: { booking: { publicId: bookingId } },
      orderBy: { createdAt: "desc" },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (intent === null) {
      throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    }
    const tx = intent.transactions[0];

    return {
      bookingId,
      paymentIntentId: intent.publicId,
      status: intent.status,
      transactionSignature: tx?.txSignature ?? null,
      verifiedAt:
        tx?.verifiedAt === null || tx?.verifiedAt === undefined ? null : iso(tx.verifiedAt),
      nextAction:
        intent.status === PaymentIntentStatus.Confirmed
          ? RiskNextAction.IssueReceipt
          : RiskNextAction.Hold
    };
  }

  async getReceipt(receiptId: string): Promise<ServiceData> {
    const receipt = await this.client.trustReceipt.findUnique({
      where: { publicId: receiptId },
      include: {
        booking: true,
        paymentIntent: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } } },
        proofRecord: { include: { agreement: true } }
      }
    });
    if (receipt === null || receipt.proofRecord === null) {
      throw new ApiCommandError(404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
    }
    const tx = receipt.paymentIntent.transactions[0];

    return {
      receiptId: receipt.publicId,
      bookingId: receipt.booking.publicId,
      status: receipt.status,
      booking: {
        bookingId: receipt.booking.publicId,
        route: `${receipt.booking.routeFrom} → ${receipt.booking.routeTo}`,
        departureAt:
          receipt.booking.departureAtUtc === null
            ? iso(receipt.issuedAt)
            : iso(receipt.booking.departureAtUtc),
        passengerCount: receipt.booking.passengerCount ?? 1,
        contactPhoneMasked: receipt.booking.contactPhoneMasked ?? "[PHONE]"
      },
      deposit: {
        amount: { currency: Currency.Vnd, minor: receipt.paymentIntent.amountMinor },
        status: receipt.paymentIntent.status
      },
      verification: {
        status: receipt.proofRecord.verificationStatus,
        agreementVersion: receipt.proofRecord.agreement.version,
        transactionSignatureShort: tx === undefined ? "mock" : shortSignature(tx.txSignature)
      }
    };
  }

  async verifyReceipt(
    receiptId: string,
    input: { candidateDepositAmountMinor?: number | undefined },
    requestId: string
  ): Promise<ServiceData> {
    const now = new Date();
    return this.client.$transaction(async (transaction) => {
      const receipt = await transaction.trustReceipt.findUnique({
        where: { publicId: receiptId }
      });
      if (receipt === null || receipt.proofRecordId === null) {
        throw new ApiCommandError(404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
      }
      const receiptBooking = await transaction.booking.findUniqueOrThrow({
        where: { id: receipt.bookingId },
        select: { publicId: true }
      });
      const receiptProof = await transaction.proofRecord.findUniqueOrThrow({
        where: { id: receipt.proofRecordId }
      });
      const receiptAgreement = await transaction.agreement.findUniqueOrThrow({
        where: { id: receiptProof.agreementId }
      });
      let status = receiptProof.verificationStatus;
      if (input.candidateDepositAmountMinor !== undefined) {
        const canonical = receiptAgreement.canonicalPayload;
        const candidate = JSON.parse(JSON.stringify(canonical)) as {
          commercialTerms?: { depositAmountVnd?: number };
        };
        if (candidate.commercialTerms !== undefined) {
          candidate.commercialTerms.depositAmountVnd = input.candidateDepositAmountMinor;
        }
        const candidateHash = sha256(JSON.stringify(candidate));
        if (candidateHash !== receiptProof.proofHashSha256) {
          status = ProofStatus.Mismatch;
          await transaction.proofRecord.update({
            where: { id: receiptProof.id },
            data: { verificationStatus: "MISMATCH", verifiedAt: now }
          });
          await transaction.trustReceipt.update({
            where: { id: receipt.id },
            data: {
              status: requireTransition(
                transitionReceipt(receipt.status as ReceiptStatusValue, ReceiptStatus.Mismatch),
                "Receipt cannot enter mismatch from its current state."
              ),
              verifiedAt: now
            }
          });
          const currentBooking = await transaction.booking.findUniqueOrThrow({
            where: { id: receipt.bookingId },
            select: { status: true }
          });
          await transitionBookingThrough(
            transaction,
            receipt.bookingId,
            currentBooking.status as BookingStatusValue,
            [BookingStatus.ManualReviewRequired]
          );
          const call = await transaction.callSession.findFirstOrThrow({
            where: { bookingId: receipt.bookingId }
          });
          await appendEvent(transaction, {
            callId: call.publicId,
            bookingId: receiptBooking.publicId,
            event: EventName.ReceiptVerified,
            data: {
              receiptId: receipt.publicId,
              status: ReceiptStatus.Mismatch,
              verification: ProofStatus.Mismatch,
              agreementVersion: receiptAgreement.version,
              verifiedAt: iso(now),
              customerMessage: "Receipt proof requires manual review.",
              nextAction: RiskNextAction.ManualReview
            },
            requestId,
            occurredAt: now
          });
        }
      }

      return {
        bookingId: receiptBooking.publicId,
        receiptId: receipt.publicId,
        status,
        agreementVersion: receiptAgreement.version,
        proofHash: receiptProof.proofHashSha256,
        verifiedAt: receiptProof.verifiedAt === null ? null : iso(receiptProof.verifiedAt),
        ...(status === ProofStatus.Mismatch ? { nextAction: RiskNextAction.ManualReview } : {})
      };
    });
  }

  /**
   * Phase 7 — DEMO_MODE only.
   * Force a payment intent into a specific failure state without manual parameter manipulation.
   * The caller must verify DEMO_MODE before invoking this method.
   */
  async simulatePaymentFailure(
    input: SimulatePaymentFailureRequest,
    requestId: string
  ): Promise<ServiceData> {
    const now = new Date();
    const intent = await this.client.paymentIntent.findUnique({
      where: { publicId: input.paymentIntentId }
    });
    if (intent === null) {
      throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    }
    if (intent.status !== "CREATED" && intent.status !== "PENDING") {
      throw new ApiCommandError(
        409,
        "PAYMENT_INTENT_ALREADY_EXISTS",
        `Payment intent is already in a terminal state: ${intent.status}.`
      );
    }

    const booking = await this.client.booking.findUniqueOrThrow({
      where: { id: intent.bookingId }
    });
    const call = await this.client.callSession.findFirstOrThrow({
      where: { bookingId: intent.bookingId }
    });

    if (input.outcome === "EXPIRED") {
      // Force-expire the intent so a subsequent verify call returns PAYMENT_INTENT_EXPIRED.
      await this.client.paymentIntent.update({
        where: { id: intent.id },
        data: { expiresAt: new Date(now.getTime() - 1000) }
      });
      return {
        paymentIntentId: intent.publicId,
        outcome: "EXPIRED",
        message:
          "Payment intent forcibly expired. Next verify call will return PAYMENT_INTENT_EXPIRED."
      };
    }

    // For wrong-value outcomes, submit a verification with deliberately wrong data.
    const verifyInput = {
      paymentIntentId: input.paymentIntentId,
      observedAmount: {
        currency: "VND",
        minor: input.outcome === "WRONG_AMOUNT" ? intent.amountMinor + 1 : intent.amountMinor
      },
      observedRecipient:
        input.outcome === "WRONG_RECIPIENT" ? "wrong-recipient-wallet" : intent.recipientWallet,
      observedReference:
        input.outcome === "WRONG_REFERENCE" ? "ref_00000000wrong" : intent.solanaReference,
      transactionSignature: `sim_fail_${opaqueId("tx")}`
    };

    const idempotencyKey = `sim-fail-${input.outcome}-${intent.publicId}-${requestId}`;
    return this.verifyMockPayment(verifyInput, idempotencyKey, requestId).then((result) => ({
      paymentIntentId: intent.publicId,
      outcome: input.outcome,
      verificationResult: result,
      booking: booking.publicId,
      call: call.publicId
    }));
  }

  async getEvents(callId: string, lastEventId?: string): Promise<EventEnvelope[]> {
    const call = await this.client.callSession.findUnique({ where: { publicId: callId } });
    if (call === null) {
      throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
    }
    const rows = await this.client.auditLog.findMany({
      where: {
        aggregateType: "CALL_STREAM",
        aggregateId: callId,
        eventId: { not: null }
      },
      orderBy: { createdAt: "asc" },
      select: { afterState: true }
    });
    const events = rows
      .map((row) => EventEnvelopeSchema.safeParse(row.afterState))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((left, right) => left.sequence - right.sequence);
    if (lastEventId === undefined) {
      return events;
    }
    const index = events.findIndex((event) => event.eventId === lastEventId);
    return index === -1 ? events : events.slice(index + 1);
  }
}
