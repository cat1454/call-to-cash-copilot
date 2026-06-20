import { z } from "zod";

import {
  CallSourceMode,
  ConfirmationMethod,
  PaymentGateStatus,
  RiskNextAction,
  TranscriptSource,
  TranscriptSpeaker
} from "../enums/index.js";
import { ErrorCodeSchema } from "../errors/index.js";
import {
  AgreementSchema,
  BookingStatusSchema,
  CallStatusSchema,
  PaymentIntentStatusSchema,
  ProofStatusSchema,
  ReceiptStatusSchema,
  RiskAssessmentSchema,
  TranscriptTurnSchema
} from "../schemas/domain.js";
import {
  BookingIdSchema,
  CallIdSchema,
  IsoTimestampSchema,
  JobIdSchema,
  MoneySchema,
  NonNegativeIntegerSchema,
  PaymentIntentIdSchema,
  PositiveIntegerSchema,
  ReceiptIdSchema,
  RequestIdSchema,
  TranscriptTurnIdSchema,
  UserIdSchema
} from "../schemas/primitives.js";

export const ApiMetaSchema = z
  .object({
    requestId: RequestIdSchema
  })
  .strict();

export const ApiSuccessEnvelopeSchema = z
  .object({
    success: z.literal(true),
    data: z.unknown(),
    meta: ApiMetaSchema
  })
  .strict();

export const ApiErrorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string().min(1),
        details: z.record(z.string(), z.unknown()).optional(),
        requestId: RequestIdSchema.optional(),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict();

export const ApiEnvelopeSchema = z.union([ApiSuccessEnvelopeSchema, ApiErrorEnvelopeSchema]);

export const createSuccessEnvelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
      meta: ApiMetaSchema
    })
    .strict();

export const CreateCallRequestSchema = z
  .object({
    channelPurpose: z.literal("BOOKING"),
    sourceMode: z.enum(CallSourceMode),
    customerId: UserIdSchema.optional(),
    operatorId: UserIdSchema.optional()
  })
  .strict();

export const CreateCallResponseSchema = z
  .object({
    callId: CallIdSchema,
    status: CallStatusSchema,
    channelName: z.string().min(1),
    sourceMode: z.enum(CallSourceMode),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const GetCallResponseSchema = z
  .object({
    callId: CallIdSchema,
    status: CallStatusSchema,
    channelName: z.string().min(1),
    startedAt: IsoTimestampSchema.nullable(),
    endedAt: IsoTimestampSchema.nullable(),
    booking: z
      .object({
        bookingId: BookingIdSchema,
        status: BookingStatusSchema
      })
      .strict()
      .nullable()
      .optional()
  })
  .strict();

export const EndCallRequestSchema = z
  .object({
    reason: z.enum(["CUSTOMER_ENDED", "OPERATOR_ENDED", "SYSTEM_ENDED"])
  })
  .strict();

export const EndCallResponseSchema = z
  .object({
    callId: CallIdSchema,
    status: CallStatusSchema,
    endedAt: IsoTimestampSchema
  })
  .strict();

const TranscriptTurnSubmissionContentSchema = z
  .object({
    clientTurnId: z.string().min(1),
    sequenceNo: PositiveIntegerSchema,
    speaker: z.enum(TranscriptSpeaker),
    content: z.string().min(1),
    language: z.string().min(1),
    isFinal: z.boolean(),
    startedAt: IsoTimestampSchema.optional(),
    endedAt: IsoTimestampSchema.optional(),
    sttConfidence: z.number().min(0).max(1).optional(),
    source: z.enum(TranscriptSource)
  })
  .strict();

export const TranscriptTurnSubmissionSchema = z
  .object({
    callId: CallIdSchema,
    turn: TranscriptTurnSubmissionContentSchema
  })
  .strict();

export const CreateTranscriptTurnRequestSchema = z
  .object({
    turn: TranscriptTurnSubmissionContentSchema
  })
  .strict();

export const TranscriptTurnSubmissionResponseSchema = z
  .object({
    turnId: TranscriptTurnIdSchema,
    callId: CallIdSchema,
    accepted: z.literal(true),
    analysisQueued: z.boolean()
  })
  .strict();

export const TranscriptListQuerySchema = z
  .object({
    afterSequenceNo: z.coerce.number().int().nonnegative().default(0),
    limit: z.coerce.number().int().min(1).max(100).default(100)
  })
  .strict();

export const TranscriptListResponseSchema = z
  .object({
    callId: CallIdSchema,
    turns: z.array(TranscriptTurnSchema)
  })
  .strict();

export const RiskAnalysisRequestSchema = z
  .object({
    callId: CallIdSchema,
    mode: z.literal("LATEST_FINAL_TURNS")
  })
  .strict();

export const RiskAnalysisResponseSchema = z
  .object({
    callId: CallIdSchema,
    analysisJobId: JobIdSchema,
    status: z.literal("QUEUED")
  })
  .strict();

export const RiskResponseSchema = RiskAssessmentSchema.pick({
  callId: true,
  assessmentId: true,
  completenessScore: true,
  disputeRisk: true,
  paymentReadiness: true,
  paymentGate: true,
  nextAction: true,
  missingFields: true,
  reasonCodes: true,
  customerMessage: true,
  assessedAt: true
}).extend({
  callId: CallIdSchema
});

export const CreateBookingRequestSchema = z
  .object({
    callId: CallIdSchema,
    routeFrom: z.string().min(1),
    routeTo: z.string().min(1),
    departureAt: IsoTimestampSchema,
    passengerCount: PositiveIntegerSchema,
    pickupPoint: z.string().min(1),
    contactPhone: z.string().min(1)
  })
  .strict();

export const CreateBookingResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    status: BookingStatusSchema,
    contactPhoneMasked: z.string().min(1)
  })
  .strict();

export const UpdateBookingRequestSchema = z
  .object({
    routeFrom: z.string().min(1).optional(),
    routeTo: z.string().min(1).optional(),
    departureAt: IsoTimestampSchema.optional(),
    passengerCount: PositiveIntegerSchema.optional(),
    pickupPoint: z.string().min(1).optional()
  })
  .strict()
  .refine(
    (update) => Object.keys(update).length > 0,
    "At least one mutable booking field is required."
  );

export const UpdateBookingResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    status: BookingStatusSchema,
    agreementInvalidated: z.boolean(),
    nextAction: z.enum(RiskNextAction)
  })
  .strict();

export const GetBookingResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    status: BookingStatusSchema,
    routeFrom: z.string().min(1).nullable(),
    routeTo: z.string().min(1).nullable(),
    departureAt: IsoTimestampSchema.nullable(),
    passengerCount: PositiveIntegerSchema.nullable(),
    pickupPoint: z.string().min(1).nullable(),
    contactPhoneMasked: z.string().min(1).nullable(),
    fareTotalVnd: NonNegativeIntegerSchema.nullable(),
    depositAmountVnd: NonNegativeIntegerSchema.nullable(),
    refundPolicyVersion: z.string().min(1).nullable(),
    agreementVersion: PositiveIntegerSchema.nullable(),
    paymentGate: z.enum(PaymentGateStatus)
  })
  .strict();

export const ConfirmBookingRequestSchema = z
  .object({
    agreementVersion: PositiveIntegerSchema,
    confirmation: z
      .object({
        method: z.enum(ConfirmationMethod),
        confirmedTurnId: TranscriptTurnIdSchema.optional(),
        text: z.string().min(1).optional()
      })
      .strict()
  })
  .strict();

export const ConfirmBookingResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    status: z.literal("AGREEMENT_LOCKED"),
    agreement: AgreementSchema.pick({ agreementId: true, version: true, sha256Hash: true }),
    paymentGate: z.literal(PaymentGateStatus.Unlocked)
  })
  .strict();

export const CreateMockPaymentIntentRequestSchema = z
  .object({
    bookingId: BookingIdSchema
  })
  .strict();

export const CreateMockPaymentIntentResponseSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    bookingId: BookingIdSchema,
    agreementId: AgreementSchema.shape.agreementId,
    status: z.literal("CREATED"),
    amount: MoneySchema,
    recipient: z.string().min(1),
    reference: z.string().min(1),
    expiresAt: IsoTimestampSchema,
    idempotencyKey: z.string().min(1)
  })
  .strict();

export const VerifyMockPaymentRequestSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    observedAmount: MoneySchema,
    observedRecipient: z.string().min(1),
    observedReference: z.string().min(1),
    transactionSignature: z.string().min(1).optional()
  })
  .strict();

export const VerifyMockPaymentResponseSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    bookingId: BookingIdSchema,
    status: z.literal("CONFIRMED"),
    transactionSignature: z.string().min(1),
    proofId: z.string().min(1),
    receiptId: ReceiptIdSchema
  })
  .strict();

export const PaymentStatusResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    paymentIntentId: PaymentIntentIdSchema,
    status: PaymentIntentStatusSchema,
    transactionSignature: z.string().min(1).nullable(),
    verifiedAt: IsoTimestampSchema.nullable(),
    nextAction: z.enum(RiskNextAction)
  })
  .strict();

export const ReceiptSummarySchema = z
  .object({
    receiptId: ReceiptIdSchema,
    bookingId: BookingIdSchema,
    status: ReceiptStatusSchema
  })
  .strict();

export const ReceiptResponseSchema = z
  .object({
    receiptId: ReceiptIdSchema,
    bookingId: BookingIdSchema,
    status: ReceiptStatusSchema,
    booking: z
      .object({
        bookingId: BookingIdSchema,
        route: z.string().min(1),
        departureAt: IsoTimestampSchema,
        passengerCount: PositiveIntegerSchema,
        contactPhoneMasked: z.string().min(1)
      })
      .strict(),
    deposit: z
      .object({
        amount: MoneySchema,
        status: PaymentIntentStatusSchema
      })
      .strict(),
    verification: z
      .object({
        status: ProofStatusSchema,
        agreementVersion: PositiveIntegerSchema,
        transactionSignatureShort: z.string().min(1)
      })
      .strict()
  })
  .strict();

export const ReceiptVerifyResponseSchema = z
  .object({
    bookingId: BookingIdSchema,
    receiptId: ReceiptIdSchema,
    status: ProofStatusSchema,
    agreementVersion: PositiveIntegerSchema,
    proofHash: z.string().regex(/^[a-f0-9]{64}$/u),
    verifiedAt: IsoTimestampSchema.nullable(),
    nextAction: z.enum(RiskNextAction).optional()
  })
  .strict();

export type CreateCallRequest = z.infer<typeof CreateCallRequestSchema>;
export type CreateTranscriptTurnRequest = z.infer<typeof CreateTranscriptTurnRequestSchema>;
export type TranscriptTurnSubmission = z.infer<typeof TranscriptTurnSubmissionSchema>;
export type RiskAnalysisRequest = z.infer<typeof RiskAnalysisRequestSchema>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type UpdateBookingRequest = z.infer<typeof UpdateBookingRequestSchema>;
export type ConfirmBookingRequest = z.infer<typeof ConfirmBookingRequestSchema>;
export type CreateMockPaymentIntentRequest = z.infer<typeof CreateMockPaymentIntentRequestSchema>;
export type VerifyMockPaymentRequest = z.infer<typeof VerifyMockPaymentRequestSchema>;
