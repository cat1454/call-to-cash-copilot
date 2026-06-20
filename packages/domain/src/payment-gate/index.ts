import {
  BookingStatus,
  PaymentGateStatus,
  RiskNextAction,
  RISK_GATE_THRESHOLDS,
  type ErrorCode,
  type PaymentGateDecision,
  type RiskReasonCode
} from "@call-to-cash/shared";

import type { CriticalBlockerCode } from "../policies/index.js";

export interface PaymentGateInput {
  completenessScore: number;
  disputeRisk: number;
  paymentReadiness: number;
  explicitConfirmation: boolean;
  agreementLocked: boolean;
  inventoryHoldActive: boolean;
  blockingReasons: readonly RiskReasonCode[];
  criticalBlockers: readonly CriticalBlockerCode[];
  thresholds?: {
    completenessMinimum: number;
    paymentReadinessMinimum: number;
    disputeRiskMaximum: number;
  };
}

export interface PaymentIntentEligibilityInput {
  bookingStatus: (typeof BookingStatus)[keyof typeof BookingStatus];
  paymentGate: PaymentGateDecision;
  inventoryHoldActive: boolean;
  hasActivePaymentIntent: boolean;
  paymentOrReceiptFinalized: boolean;
}

export interface PaymentIntentEligibility {
  allowed: boolean;
  reasonCodes: ErrorCode[];
}

type RiskNextActionValue = (typeof RiskNextAction)[keyof typeof RiskNextAction];

export function evaluatePaymentGate(input: PaymentGateInput): PaymentGateDecision {
  const thresholds = input.thresholds ?? RISK_GATE_THRESHOLDS;

  if (input.criticalBlockers.length > 0) {
    return PaymentGateStatus.ManualReviewRequired;
  }

  if (input.blockingReasons.length > 0) {
    return PaymentGateStatus.Locked;
  }

  if (input.disputeRisk > thresholds.disputeRiskMaximum) {
    return PaymentGateStatus.Locked;
  }

  if (input.completenessScore < thresholds.completenessMinimum) {
    return PaymentGateStatus.Locked;
  }

  if (!input.agreementLocked || !input.explicitConfirmation) {
    return PaymentGateStatus.ReadyForConfirmation;
  }

  if (input.paymentReadiness < thresholds.paymentReadinessMinimum) {
    return PaymentGateStatus.ReadyForConfirmation;
  }

  if (!input.inventoryHoldActive) {
    return PaymentGateStatus.Locked;
  }

  return PaymentGateStatus.Unlocked;
}

export function getRequiredNextAction(decision: PaymentGateDecision): RiskNextActionValue {
  switch (decision) {
    case PaymentGateStatus.Locked:
      return RiskNextAction.AskClarification;
    case PaymentGateStatus.ReadyForConfirmation:
      return RiskNextAction.AskConfirmation;
    case PaymentGateStatus.Unlocked:
      return RiskNextAction.Open;
    case PaymentGateStatus.ManualReviewRequired:
      return RiskNextAction.Block;
  }
}

export function canCreatePaymentIntent(
  input: PaymentIntentEligibilityInput
): PaymentIntentEligibility {
  if (input.paymentOrReceiptFinalized) {
    return { allowed: false, reasonCodes: ["PAYMENT_INTENT_ALREADY_EXISTS"] };
  }

  if (input.bookingStatus !== BookingStatus.AgreementLocked) {
    return { allowed: false, reasonCodes: ["AGREEMENT_NOT_READY"] };
  }

  if (input.paymentGate === PaymentGateStatus.ManualReviewRequired) {
    return { allowed: false, reasonCodes: ["PAYMENT_GATE_MANUAL_REVIEW"] };
  }

  if (input.paymentGate !== PaymentGateStatus.Unlocked) {
    return { allowed: false, reasonCodes: ["PAYMENT_GATE_LOCKED"] };
  }

  if (!input.inventoryHoldActive) {
    return { allowed: false, reasonCodes: ["INVENTORY_HOLD_EXPIRED"] };
  }

  if (input.hasActivePaymentIntent) {
    return { allowed: false, reasonCodes: ["PAYMENT_INTENT_ALREADY_EXISTS"] };
  }

  return { allowed: true, reasonCodes: [] };
}
