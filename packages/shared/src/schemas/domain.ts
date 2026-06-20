import { z } from "zod";

import { AGREEMENT_CANONICALIZATION_VERSION, RISK_POLICY_VERSION } from "../constants/index.js";
import {
  AgreementStatus,
  BookingField,
  BookingStatus,
  CallSourceMode,
  CallStatus,
  ConfirmationMethod,
  Currency,
  ExtractionStatus,
  FieldConfirmationActor,
  FieldProvenanceSource,
  FieldProvenanceStatus,
  InventoryHoldStatus,
  PaymentAnchorType,
  PaymentGateStatus,
  PaymentIntentStatus,
  PaymentTransactionStatus,
  ProofStatus,
  ReceiptStatus,
  RiskNextAction,
  TranscriptSource,
  TranscriptSpeaker
} from "../enums/index.js";
import {
  AgreementIdSchema,
  BookingIdSchema,
  CallIdSchema,
  CurrencySchema,
  ExtractionIdSchema,
  InventoryReservationIdSchema,
  IsoTimestampSchema,
  MaskedContactSchema,
  MoneySchema,
  NonNegativeIntegerSchema,
  PaymentIntentIdSchema,
  PositiveIntegerSchema,
  ProofIdSchema,
  ReceiptIdSchema,
  RiskAssessmentIdSchema,
  ScoreSchema,
  Sha256HashSchema,
  TranscriptTurnIdSchema,
  UserIdSchema
} from "./primitives.js";

export const CallStatusSchema = z.enum(CallStatus);
export const BookingStatusSchema = z.enum(BookingStatus);
export const PaymentGateStatusSchema = z.enum(PaymentGateStatus);
export const PaymentIntentStatusSchema = z.enum(PaymentIntentStatus);
export const PaymentTransactionStatusSchema = z.enum(PaymentTransactionStatus);
export const ProofStatusSchema = z.enum(ProofStatus);
export const ReceiptStatusSchema = z.enum(ReceiptStatus);
export const InventoryHoldStatusSchema = z.enum(InventoryHoldStatus);
export const AgreementStatusSchema = z.enum(AgreementStatus);
export const CallSourceModeSchema = z.enum(CallSourceMode);
export const TranscriptSpeakerSchema = z.enum(TranscriptSpeaker);
export const TranscriptSourceSchema = z.enum(TranscriptSource);
export const ConfirmationMethodSchema = z.enum(ConfirmationMethod);
export const BookingFieldSchema = z.enum(BookingField);
export const RiskNextActionSchema = z.enum(RiskNextAction);

export const RISK_REASON_CODE_VALUES = [
  "MISSING_ROUTE",
  "MISSING_DEPARTURE_TIME",
  "MISSING_PASSENGER_COUNT",
  "MISSING_PICKUP_POINT",
  "MISSING_CONTACT",
  "MISSING_PRICE",
  "MISSING_DEPOSIT_AMOUNT",
  "MISSING_REFUND_POLICY",
  "AMBIGUOUS_DEPARTURE_TIME",
  "AMBIGUOUS_CONFIRMATION",
  "PRICE_NOT_CONFIRMED",
  "DEPOSIT_NOT_CONFIRMED",
  "REFUND_POLICY_NOT_CONFIRMED",
  "CUSTOMER_CHANGED_TERMS",
  "INVENTORY_UNAVAILABLE",
  "INVENTORY_HOLD_EXPIRED",
  "PAYMENT_TIMEOUT",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_RECIPIENT_MISMATCH",
  "PAYMENT_REFERENCE_MISMATCH",
  "PAYMENT_DUPLICATE_DETECTED",
  "AGREEMENT_VERSION_STALE",
  "PROOF_MISMATCH",
  "LOW_TRANSCRIPT_CONFIDENCE",
  "CALL_DROPPED",
  "PROVIDER_WEBHOOK_FAILED",
  "MANUAL_REVIEW_REQUESTED",
  "POLICY_EXCEPTION_REQUESTED"
] as const;

export const RiskReasonCodeSchema = z.enum(RISK_REASON_CODE_VALUES);

export const FieldProvenanceSchema = z
  .object({
    source: z.enum(FieldProvenanceSource),
    transcriptSegmentId: TranscriptTurnIdSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    status: z.enum(FieldProvenanceStatus),
    confirmedBy: z.enum(FieldConfirmationActor).optional(),
    confirmedAt: IsoTimestampSchema.optional()
  })
  .strict();

export const CallSessionSchema = z
  .object({
    callId: CallIdSchema,
    status: CallStatusSchema,
    channelName: z.string().min(1),
    sourceMode: CallSourceModeSchema,
    customerId: UserIdSchema.nullable().optional(),
    operatorId: UserIdSchema.nullable().optional(),
    startedAt: IsoTimestampSchema.nullable().optional(),
    endedAt: IsoTimestampSchema.nullable().optional(),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const TranscriptTurnSchema = z
  .object({
    turnId: TranscriptTurnIdSchema,
    callId: CallIdSchema,
    sequenceNo: PositiveIntegerSchema,
    speaker: TranscriptSpeakerSchema,
    content: z.string().min(1),
    language: z.string().min(1),
    isFinal: z.boolean(),
    startedAt: IsoTimestampSchema.nullable().optional(),
    endedAt: IsoTimestampSchema.nullable().optional(),
    sttConfidence: z.number().min(0).max(1).nullable().optional(),
    source: TranscriptSourceSchema,
    createdAt: IsoTimestampSchema
  })
  .strict();

const BookingServiceSchema = z
  .object({
    vertical: z.literal("INTERCITY_BUS"),
    routeFrom: z.string().min(1).optional(),
    routeTo: z.string().min(1).optional(),
    departureAt: IsoTimestampSchema.optional(),
    passengerCount: PositiveIntegerSchema.optional(),
    pickupPoint: z.string().min(1).optional(),
    inventoryReservationId: InventoryReservationIdSchema.optional(),
    inventoryHoldExpiresAt: IsoTimestampSchema.optional()
  })
  .strict();

const BookingCustomerSchema = z
  .object({
    contactMasked: MaskedContactSchema.optional(),
    name: z.string().min(1).optional()
  })
  .strict();

const BookingPricingSchema = z
  .object({
    fareTotalVnd: NonNegativeIntegerSchema.optional(),
    depositAmountVnd: NonNegativeIntegerSchema.optional(),
    currency: z.enum(Currency),
    refundPolicyVersion: z.string().min(1).optional()
  })
  .strict();

const BookingConfirmationsSchema = z
  .object({
    refundPolicyConfirmed: z.boolean(),
    explicitConfirmation: z.boolean(),
    explicitConfirmationForAgreementVersion: PositiveIntegerSchema.optional()
  })
  .strict();

export const BookingDraftSchema = z
  .object({
    bookingId: BookingIdSchema,
    status: BookingStatusSchema,
    service: BookingServiceSchema,
    customer: BookingCustomerSchema,
    pricing: BookingPricingSchema,
    confirmations: BookingConfirmationsSchema,
    provenance: z.record(z.string(), FieldProvenanceSchema),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema
  })
  .strict();

export const BookingExtractionSchema = z
  .object({
    extractionId: ExtractionIdSchema,
    callId: CallIdSchema,
    status: z.enum(ExtractionStatus),
    extractedFields: z
      .object({
        routeFrom: z.string().min(1).optional(),
        routeTo: z.string().min(1).optional(),
        departureAt: IsoTimestampSchema.optional(),
        passengerCount: PositiveIntegerSchema.optional(),
        pickupPoint: z.string().min(1).optional(),
        contact: z.string().min(1).optional()
      })
      .strict(),
    fieldConfidence: z.record(z.string(), z.number().min(0).max(1)),
    missingFields: z.array(BookingFieldSchema),
    contradictions: z.array(
      z
        .object({
          field: BookingFieldSchema,
          evidenceSegmentIds: z.array(TranscriptTurnIdSchema).min(1)
        })
        .strict()
    ),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const RiskEvidenceSchema = z
  .object({
    field: BookingFieldSchema.optional(),
    turnId: TranscriptTurnIdSchema.optional(),
    rule: z.string().min(1)
  })
  .strict();

export const RiskAssessmentSchema = z
  .object({
    assessmentId: RiskAssessmentIdSchema,
    callId: CallIdSchema.nullable().optional(),
    bookingId: BookingIdSchema.nullable().optional(),
    policyVersion: z.string().min(1).default(RISK_POLICY_VERSION),
    completenessScore: ScoreSchema,
    disputeRisk: ScoreSchema,
    paymentReadiness: ScoreSchema,
    agentQuality: ScoreSchema.nullable().optional(),
    paymentGate: PaymentGateStatusSchema,
    nextAction: RiskNextActionSchema,
    missingFields: z.array(BookingFieldSchema),
    reasonCodes: z.array(RiskReasonCodeSchema),
    evidence: z.array(RiskEvidenceSchema),
    customerMessage: z.string().min(1),
    assessedAt: IsoTimestampSchema
  })
  .strict();

const AgreementServiceSchema = z
  .object({
    routeFrom: z.string().min(1),
    routeTo: z.string().min(1),
    departureAt: IsoTimestampSchema,
    passengerCount: PositiveIntegerSchema,
    pickupPoint: z.string().min(1),
    inventoryReservationId: InventoryReservationIdSchema,
    holdExpiresAt: IsoTimestampSchema
  })
  .strict();

const AgreementCommercialTermsSchema = z
  .object({
    fareTotalVnd: NonNegativeIntegerSchema,
    depositAmountVnd: PositiveIntegerSchema,
    currency: CurrencySchema,
    refundPolicyVersion: z.string().min(1),
    refundPolicySummary: z.string().min(1)
  })
  .strict();

const CustomerAcknowledgementSchema = z
  .object({
    contactMasked: MaskedContactSchema,
    explicitConfirmationAt: IsoTimestampSchema.nullable().optional(),
    confirmationMethod: ConfirmationMethodSchema.nullable().optional()
  })
  .strict();

export const AgreementSchema = z
  .object({
    agreementId: AgreementIdSchema,
    bookingId: BookingIdSchema,
    version: PositiveIntegerSchema,
    status: AgreementStatusSchema,
    service: AgreementServiceSchema,
    commercialTerms: AgreementCommercialTermsSchema,
    customerAcknowledgement: CustomerAcknowledgementSchema,
    canonicalizationVersion: z.literal(AGREEMENT_CANONICALIZATION_VERSION),
    sha256Hash: Sha256HashSchema.optional(),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const PaymentIntentSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    bookingId: BookingIdSchema,
    agreementId: AgreementIdSchema,
    status: PaymentIntentStatusSchema,
    amount: MoneySchema,
    recipientWallet: z.string().min(1),
    reference: z.string().min(1),
    memoHash: Sha256HashSchema.optional(),
    expiresAt: IsoTimestampSchema,
    createdAt: IsoTimestampSchema
  })
  .strict();

export const PaymentVerificationSchema = z
  .object({
    paymentIntentId: PaymentIntentIdSchema,
    transactionSignature: z.string().min(1),
    status: PaymentTransactionStatusSchema,
    observedAmount: MoneySchema.nullable().optional(),
    observedReference: z.string().min(1).nullable().optional(),
    verifiedAt: IsoTimestampSchema.nullable().optional()
  })
  .strict();

export const ProofRecordSchema = z
  .object({
    proofId: ProofIdSchema,
    bookingId: BookingIdSchema,
    agreementId: AgreementIdSchema,
    paymentIntentId: PaymentIntentIdSchema.optional(),
    proofHash: Sha256HashSchema,
    anchorType: z.enum(PaymentAnchorType),
    anchorValue: z.string().min(1),
    verificationStatus: ProofStatusSchema,
    verifiedAt: IsoTimestampSchema.nullable().optional(),
    createdAt: IsoTimestampSchema
  })
  .strict();

export const TrustReceiptSchema = z
  .object({
    receiptId: ReceiptIdSchema,
    bookingId: BookingIdSchema,
    status: ReceiptStatusSchema,
    verificationStatus: ProofStatusSchema,
    agreementVersion: PositiveIntegerSchema,
    transactionSignatureShort: z.string().min(1).nullable().optional(),
    issuedAt: IsoTimestampSchema,
    verifiedAt: IsoTimestampSchema.nullable().optional()
  })
  .strict();

export type CallSession = z.infer<typeof CallSessionSchema>;
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;
export type BookingDraft = z.infer<typeof BookingDraftSchema>;
export type BookingExtraction = z.infer<typeof BookingExtractionSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type PaymentGateDecision = z.infer<typeof PaymentGateStatusSchema>;
export type Agreement = z.infer<typeof AgreementSchema>;
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
export type PaymentVerification = z.infer<typeof PaymentVerificationSchema>;
export type ProofRecord = z.infer<typeof ProofRecordSchema>;
export type TrustReceipt = z.infer<typeof TrustReceiptSchema>;
