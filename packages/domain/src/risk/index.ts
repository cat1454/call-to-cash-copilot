import { RISK_GATE_THRESHOLDS } from "@call-to-cash/shared";

import {
  COMPLETENESS_WEIGHTS,
  DISPUTE_RISK_WEIGHTS,
  PAYMENT_READINESS_WEIGHTS
} from "../policies/index.js";

import type { RiskReasonCode } from "@call-to-cash/shared";

export interface CompletenessInput {
  routeValid: boolean;
  departureValid: boolean;
  passengerCountValid: boolean;
  pickupPointValid: boolean;
  contactValid: boolean;
  inventoryHoldActive: boolean;
  pricingCurrent: boolean;
  depositCalculated: boolean;
  refundPolicyAttached: boolean;
  termsRenderable: boolean;
}

export interface PaymentReadinessInput {
  termsRendered: boolean;
  totalPriceConfirmed: boolean;
  depositConfirmed: boolean;
  refundPolicyConfirmed: boolean;
  explicitConfirmation: boolean;
  paymentIntentReady: boolean;
}

export interface RiskSignal {
  code: RiskReasonCode;
  status: "ACTIVE" | "RESOLVED";
}

export function calculateCompleteness(input: CompletenessInput): number {
  return (
    (input.routeValid ? COMPLETENESS_WEIGHTS.route : 0) +
    (input.departureValid ? COMPLETENESS_WEIGHTS.departure : 0) +
    (input.passengerCountValid ? COMPLETENESS_WEIGHTS.passengerCount : 0) +
    (input.pickupPointValid ? COMPLETENESS_WEIGHTS.pickupPoint : 0) +
    (input.contactValid ? COMPLETENESS_WEIGHTS.contact : 0) +
    (input.inventoryHoldActive ? COMPLETENESS_WEIGHTS.inventoryHold : 0) +
    (input.pricingCurrent ? COMPLETENESS_WEIGHTS.pricing : 0) +
    (input.depositCalculated ? COMPLETENESS_WEIGHTS.deposit : 0) +
    (input.refundPolicyAttached ? COMPLETENESS_WEIGHTS.refundPolicy : 0) +
    (input.termsRenderable ? COMPLETENESS_WEIGHTS.termsRenderable : 0)
  );
}

export function calculateDisputeRisk(signals: readonly RiskSignal[]): number {
  const score = signals.reduce((total, signal) => {
    if (signal.status !== "ACTIVE") {
      return total;
    }

    return total + (DISPUTE_RISK_WEIGHTS[signal.code] ?? 0);
  }, 0);

  return Math.min(100, score);
}

export function calculatePaymentReadiness(input: PaymentReadinessInput): number {
  return (
    (input.termsRendered ? PAYMENT_READINESS_WEIGHTS.termsRendered : 0) +
    (input.totalPriceConfirmed ? PAYMENT_READINESS_WEIGHTS.totalPriceConfirmed : 0) +
    (input.depositConfirmed ? PAYMENT_READINESS_WEIGHTS.depositConfirmed : 0) +
    (input.refundPolicyConfirmed ? PAYMENT_READINESS_WEIGHTS.refundPolicyConfirmed : 0) +
    (input.explicitConfirmation ? PAYMENT_READINESS_WEIGHTS.explicitConfirmation : 0) +
    (input.paymentIntentReady ? PAYMENT_READINESS_WEIGHTS.paymentIntentReady : 0)
  );
}

export const DEFAULT_RISK_GATE_THRESHOLDS = RISK_GATE_THRESHOLDS;
