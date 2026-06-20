import type { RiskReasonCode } from "@call-to-cash/shared";

export const COMPLETENESS_WEIGHTS = {
  route: 15,
  departure: 15,
  passengerCount: 12,
  pickupPoint: 10,
  contact: 10,
  inventoryHold: 15,
  pricing: 10,
  deposit: 5,
  refundPolicy: 5,
  termsRenderable: 3
} as const;

export const PAYMENT_READINESS_WEIGHTS = {
  termsRendered: 20,
  totalPriceConfirmed: 15,
  depositConfirmed: 20,
  refundPolicyConfirmed: 15,
  explicitConfirmation: 25,
  paymentIntentReady: 5
} as const;

export const DISPUTE_RISK_WEIGHTS: Partial<Record<RiskReasonCode, number>> = {
  AMBIGUOUS_CONFIRMATION: 25,
  PRICE_NOT_CONFIRMED: 25,
  REFUND_POLICY_NOT_CONFIRMED: 20,
  AMBIGUOUS_DEPARTURE_TIME: 30,
  CUSTOMER_CHANGED_TERMS: 20,
  INVENTORY_UNAVAILABLE: 20,
  CALL_DROPPED: 30,
  PAYMENT_AMOUNT_MISMATCH: 80,
  PAYMENT_RECIPIENT_MISMATCH: 100,
  PAYMENT_REFERENCE_MISMATCH: 80,
  AGREEMENT_VERSION_STALE: 60,
  PROOF_MISMATCH: 100
};

export type CriticalBlockerCode =
  | "AGREEMENT_VERSION_STALE"
  | "PAYMENT_OR_RECEIPT_ALREADY_FINALIZED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_RECIPIENT_MISMATCH"
  | "PAYMENT_REFERENCE_MISMATCH"
  | "PROOF_MISMATCH";
