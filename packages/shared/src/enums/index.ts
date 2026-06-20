export const CallStatus = {
  Created: "CREATED",
  Active: "ACTIVE",
  Ended: "ENDED",
  Failed: "FAILED",
  Cancelled: "CANCELLED"
} as const;

export const BookingStatus = {
  Draft: "DRAFT",
  FieldsPartial: "FIELDS_PARTIAL",
  BookingDraftReady: "BOOKING_DRAFT_READY",
  AgreementReady: "AGREEMENT_READY",
  AgreementLocked: "AGREEMENT_LOCKED",
  PaymentPending: "PAYMENT_PENDING",
  PaymentConfirmed: "PAYMENT_CONFIRMED",
  BookingConfirmed: "BOOKING_CONFIRMED",
  ReceiptIssued: "RECEIPT_ISSUED",
  Cancelled: "CANCELLED",
  ManualReviewRequired: "MANUAL_REVIEW_REQUIRED",
  Expired: "EXPIRED"
} as const;

export const PaymentGateStatus = {
  Locked: "LOCKED",
  ReadyForConfirmation: "READY_FOR_CONFIRMATION",
  Unlocked: "UNLOCKED",
  ManualReviewRequired: "MANUAL_REVIEW_REQUIRED"
} as const;

export const PaymentIntentStatus = {
  NotCreated: "NOT_CREATED",
  Created: "CREATED",
  Pending: "PENDING",
  Confirmed: "CONFIRMED",
  Failed: "FAILED",
  Expired: "EXPIRED",
  Rejected: "REJECTED",
  ManualReviewRequired: "MANUAL_REVIEW_REQUIRED",
  Cancelled: "CANCELLED"
} as const;

export const PaymentTransactionStatus = {
  Observed: "OBSERVED",
  Validating: "VALIDATING",
  Confirmed: "CONFIRMED",
  Rejected: "REJECTED",
  Failed: "FAILED"
} as const;

export const ProofStatus = {
  Pending: "PENDING",
  Match: "MATCH",
  Mismatch: "MISMATCH",
  Unavailable: "UNAVAILABLE"
} as const;

export const ReceiptStatus = {
  NotCreated: "NOT_CREATED",
  Issued: "ISSUED",
  VerifiedMatch: "VERIFIED_MATCH",
  Mismatch: "MISMATCH",
  ManualReview: "MANUAL_REVIEW"
} as const;

export const InventoryHoldStatus = {
  Active: "ACTIVE",
  Released: "RELEASED",
  Expired: "EXPIRED",
  Consumed: "CONSUMED"
} as const;

export const AgreementStatus = {
  Draft: "DRAFT",
  Ready: "READY",
  Locked: "LOCKED",
  Superseded: "SUPERSEDED",
  Expired: "EXPIRED"
} as const;

export const CallSourceMode = {
  LiveAgora: "LIVE_AGORA",
  TranscriptReplay: "TRANSCRIPT_REPLAY",
  Demo: "DEMO"
} as const;

export const TranscriptSpeaker = {
  Customer: "CUSTOMER",
  Agent: "AGENT",
  Operator: "OPERATOR",
  System: "SYSTEM"
} as const;

export const TranscriptSource = {
  Agora: "AGORA",
  Replay: "REPLAY",
  Manual: "MANUAL"
} as const;

export const FieldProvenanceSource = {
  CustomerVoice: "customer_voice",
  CustomerText: "customer_text",
  Operator: "operator",
  Inventory: "inventory",
  Pricing: "pricing",
  System: "system"
} as const;

export const FieldProvenanceStatus = {
  Proposed: "proposed",
  Confirmed: "confirmed",
  Corrected: "corrected",
  Invalidated: "invalidated"
} as const;

export const FieldConfirmationActor = {
  Customer: "customer",
  Operator: "operator",
  System: "system"
} as const;

export const ConfirmationMethod = {
  Voice: "VOICE",
  Web: "WEB",
  Operator: "OPERATOR"
} as const;

export const ExtractionStatus = {
  Proposed: "PROPOSED",
  Accepted: "ACCEPTED",
  Rejected: "REJECTED",
  Superseded: "SUPERSEDED"
} as const;

export const Currency = {
  Vnd: "VND"
} as const;

export const PaymentAnchorType = {
  SolanaMemo: "SOLANA_MEMO",
  SolanaReference: "SOLANA_REFERENCE",
  ServerAttestation: "SERVER_ATTESTATION"
} as const;

export const RiskNextAction = {
  AskClarification: "ASK_CLARIFICATION",
  Hold: "HOLD",
  AskConfirmation: "ASK_CONFIRMATION",
  Open: "OPEN",
  Block: "BLOCK",
  Handoff: "HANDOFF",
  RenderUpdatedAgreement: "RENDER_UPDATED_AGREEMENT",
  IssueReceipt: "ISSUE_RECEIPT",
  ManualReview: "MANUAL_REVIEW"
} as const;

export const BookingField = {
  RouteFrom: "routeFrom",
  RouteTo: "routeTo",
  DepartureAt: "departureAt",
  PassengerCount: "passengerCount",
  PickupPoint: "pickupPoint",
  ContactPhone: "contactPhone",
  FareTotalVnd: "fareTotalVnd",
  DepositAmountVnd: "depositAmountVnd",
  RefundPolicyVersion: "refundPolicyVersion",
  RefundPolicyConfirmation: "refundPolicyConfirmation",
  ExplicitConfirmation: "explicitConfirmation",
  InventoryReservation: "inventoryReservation"
} as const;

export type EnumValue<T extends Record<string, string>> = T[keyof T];
