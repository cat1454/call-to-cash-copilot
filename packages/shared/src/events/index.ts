import { z } from "zod";

import {
  BookingStatus,
  CallStatus,
  PaymentGateStatus,
  PaymentIntentStatus,
  ProofStatus,
  ReceiptStatus,
  RiskNextAction
} from "../enums/index.js";
import { ErrorCodeSchema } from "../errors/index.js";
import {
  PaymentGateStatusSchema,
  RiskNextActionSchema,
  RiskReasonCodeSchema
} from "../schemas/domain.js";
import {
  AgreementIdSchema,
  BookingIdSchema,
  CallIdSchema,
  EventIdSchema,
  IsoTimestampSchema,
  MoneySchema,
  PaymentIntentIdSchema,
  PositiveIntegerSchema,
  ReceiptIdSchema,
  RequestIdSchema,
  RiskAssessmentIdSchema,
  TranscriptTurnIdSchema
} from "../schemas/primitives.js";

export const EventName = {
  CallCreated: "call.created",
  CallJoined: "call.joined",
  CallEnded: "call.ended",
  CallFailed: "call.failed",
  TranscriptTurnCreated: "transcript.turn.created",
  TranscriptAnalysisUpdated: "transcript.analysis.updated",
  RiskScoreUpdated: "risk.score.updated",
  RiskPaymentGateUpdated: "risk.payment_gate.updated",
  BookingCreated: "booking.created",
  BookingUpdated: "booking.updated",
  BookingConfirmed: "booking.confirmed",
  PaymentIntentCreated: "payment.intent.created",
  PaymentPending: "payment.pending",
  PaymentConfirmed: "payment.confirmed",
  PaymentFailed: "payment.failed",
  ReceiptCreated: "receipt.created",
  ReceiptVerified: "receipt.verified"
} as const;

export const EventNameSchema = z.enum(EventName);

const EventEnvelopeBaseSchema = z
  .object({
    eventId: EventIdSchema,
    version: PositiveIntegerSchema,
    occurredAt: IsoTimestampSchema,
    correlationId: RequestIdSchema.optional(),
    callId: CallIdSchema,
    bookingId: BookingIdSchema.nullable(),
    sequence: PositiveIntegerSchema
  })
  .strict();

const callCreatedDataSchema = z
  .object({
    status: z.literal(CallStatus.Created),
    channelName: z.string().min(1),
    sourceMode: z.enum(["LIVE_AGORA", "TRANSCRIPT_REPLAY", "DEMO"])
  })
  .strict();

const callJoinedDataSchema = z
  .object({
    status: z.literal(CallStatus.Active),
    participantRole: z.enum(["CUSTOMER", "AGENT", "OPERATOR"]),
    startedAt: IsoTimestampSchema
  })
  .strict();

const callEndedDataSchema = z
  .object({
    status: z.union([z.literal(CallStatus.Ended), z.literal(CallStatus.Cancelled)]),
    reason: z.string().min(1),
    endedAt: IsoTimestampSchema
  })
  .strict();

const callFailedDataSchema = z
  .object({
    status: z.literal(CallStatus.Failed),
    errorCode: ErrorCodeSchema,
    retryable: z.boolean(),
    customerMessage: z.string().min(1)
  })
  .strict();

const transcriptTurnCreatedDataSchema = z
  .object({
    turnId: TranscriptTurnIdSchema,
    sequenceNo: PositiveIntegerSchema,
    speaker: z.enum(["CUSTOMER", "AGENT", "OPERATOR", "SYSTEM"]),
    content: z.string().min(1),
    isFinal: z.literal(true),
    timestamp: IsoTimestampSchema
  })
  .strict();

const transcriptAnalysisUpdatedDataSchema = z
  .object({
    extractionId: z.string().regex(/^ext_[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/u),
    understood: z.record(z.string(), z.unknown()),
    missingFields: z.array(z.string().min(1)),
    contradictions: z.array(z.unknown()),
    nextQuestion: z.string().min(1)
  })
  .strict();

const riskScoreUpdatedDataSchema = z
  .object({
    assessmentId: RiskAssessmentIdSchema,
    completenessScore: z.number().int().min(0).max(100),
    disputeRisk: z.number().int().min(0).max(100),
    paymentReadiness: z.number().int().min(0).max(100),
    paymentGate: PaymentGateStatusSchema,
    nextAction: RiskNextActionSchema,
    missingFields: z.array(z.string().min(1)),
    reasonCodes: z.array(RiskReasonCodeSchema),
    customerMessage: z.string().min(1)
  })
  .strict();

const riskPaymentGateUpdatedDataSchema = z
  .object({
    previousDecision: PaymentGateStatusSchema,
    paymentGate: PaymentGateStatusSchema,
    nextAction: RiskNextActionSchema,
    reasonCodes: z.array(RiskReasonCodeSchema),
    agreementVersion: PositiveIntegerSchema.nullable().optional()
  })
  .strict();

const bookingCreatedDataSchema = z
  .object({
    status: z.literal(BookingStatus.Draft),
    bookingId: BookingIdSchema
  })
  .strict();

const bookingUpdatedDataSchema = z
  .object({
    status: z.enum(BookingStatus),
    changedFields: z.array(z.string().min(1)).min(1),
    agreementInvalidated: z.boolean(),
    nextAction: z.literal(RiskNextAction.RenderUpdatedAgreement)
  })
  .strict();

const bookingConfirmedDataSchema = z
  .object({
    status: z.literal(BookingStatus.AgreementLocked),
    agreementId: AgreementIdSchema,
    agreementVersion: PositiveIntegerSchema,
    paymentGate: z.literal(PaymentGateStatus.Unlocked)
  })
  .strict();

const paymentIntentCreatedDataSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    status: z.literal(PaymentIntentStatus.Created),
    amount: MoneySchema,
    reference: z.string().min(1),
    expiresAt: IsoTimestampSchema
  })
  .strict();

const paymentPendingDataSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    status: z.literal(PaymentIntentStatus.Pending),
    transactionSignatureShort: z.string().min(1)
  })
  .strict();

const paymentConfirmedDataSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    status: z.literal(PaymentIntentStatus.Confirmed),
    transactionSignatureShort: z.string().min(1),
    verifiedAt: IsoTimestampSchema,
    nextAction: z.literal(RiskNextAction.IssueReceipt)
  })
  .strict();

const paymentFailedDataSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    status: z.union([
      z.literal(PaymentIntentStatus.Rejected),
      z.literal(PaymentIntentStatus.Failed),
      z.literal(PaymentIntentStatus.ManualReviewRequired)
    ]),
    errorCode: ErrorCodeSchema,
    retryable: z.boolean(),
    customerMessage: z.string().min(1)
  })
  .strict();

const receiptCreatedDataSchema = z
  .object({
    receiptId: ReceiptIdSchema,
    status: z.literal(ReceiptStatus.Issued),
    verification: z.literal(ProofStatus.Pending)
  })
  .strict();

const receiptVerifiedDataSchema = z
  .object({
    receiptId: ReceiptIdSchema,
    status: z.union([
      z.literal(ReceiptStatus.VerifiedMatch),
      z.literal(ReceiptStatus.Mismatch),
      z.literal(ReceiptStatus.ManualReview)
    ]),
    verification: z.union([z.literal(ProofStatus.Match), z.literal(ProofStatus.Mismatch)]),
    agreementVersion: PositiveIntegerSchema,
    verifiedAt: IsoTimestampSchema.optional(),
    customerMessage: z.string().min(1).optional(),
    nextAction: z.literal(RiskNextAction.ManualReview).optional()
  })
  .strict();

const createEventSchema = <T extends z.ZodType>(event: string, data: T) =>
  EventEnvelopeBaseSchema.extend({ event: z.literal(event), data });

export const CallCreatedEventSchema = createEventSchema(
  EventName.CallCreated,
  callCreatedDataSchema
);
export const CallJoinedEventSchema = createEventSchema(EventName.CallJoined, callJoinedDataSchema);
export const CallEndedEventSchema = createEventSchema(EventName.CallEnded, callEndedDataSchema);
export const CallFailedEventSchema = createEventSchema(EventName.CallFailed, callFailedDataSchema);
export const TranscriptTurnCreatedEventSchema = createEventSchema(
  EventName.TranscriptTurnCreated,
  transcriptTurnCreatedDataSchema
);
export const TranscriptAnalysisUpdatedEventSchema = createEventSchema(
  EventName.TranscriptAnalysisUpdated,
  transcriptAnalysisUpdatedDataSchema
);
export const RiskScoreUpdatedEventSchema = createEventSchema(
  EventName.RiskScoreUpdated,
  riskScoreUpdatedDataSchema
);
export const RiskPaymentGateUpdatedEventSchema = createEventSchema(
  EventName.RiskPaymentGateUpdated,
  riskPaymentGateUpdatedDataSchema
);
export const BookingCreatedEventSchema = createEventSchema(
  EventName.BookingCreated,
  bookingCreatedDataSchema
);
export const BookingUpdatedEventSchema = createEventSchema(
  EventName.BookingUpdated,
  bookingUpdatedDataSchema
);
export const BookingConfirmedEventSchema = createEventSchema(
  EventName.BookingConfirmed,
  bookingConfirmedDataSchema
);
export const PaymentIntentCreatedEventSchema = createEventSchema(
  EventName.PaymentIntentCreated,
  paymentIntentCreatedDataSchema
);
export const PaymentPendingEventSchema = createEventSchema(
  EventName.PaymentPending,
  paymentPendingDataSchema
);
export const PaymentConfirmedEventSchema = createEventSchema(
  EventName.PaymentConfirmed,
  paymentConfirmedDataSchema
);
export const PaymentFailedEventSchema = createEventSchema(
  EventName.PaymentFailed,
  paymentFailedDataSchema
);
export const ReceiptCreatedEventSchema = createEventSchema(
  EventName.ReceiptCreated,
  receiptCreatedDataSchema
);
export const ReceiptVerifiedEventSchema = createEventSchema(
  EventName.ReceiptVerified,
  receiptVerifiedDataSchema
);

export const EventEnvelopeSchema = z.discriminatedUnion("event", [
  CallCreatedEventSchema,
  CallJoinedEventSchema,
  CallEndedEventSchema,
  CallFailedEventSchema,
  TranscriptTurnCreatedEventSchema,
  TranscriptAnalysisUpdatedEventSchema,
  RiskScoreUpdatedEventSchema,
  RiskPaymentGateUpdatedEventSchema,
  BookingCreatedEventSchema,
  BookingUpdatedEventSchema,
  BookingConfirmedEventSchema,
  PaymentIntentCreatedEventSchema,
  PaymentPendingEventSchema,
  PaymentConfirmedEventSchema,
  PaymentFailedEventSchema,
  ReceiptCreatedEventSchema,
  ReceiptVerifiedEventSchema
]);

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
