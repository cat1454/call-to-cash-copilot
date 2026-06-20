import type {
  EvaluationScenario,
  PaymentGateDecision
} from "../schemas/evaluation-scenario.schema.js";
import type { EvaluationActual } from "../schemas/evaluation-result.schema.js";

const categoryGate: Partial<Record<EvaluationScenario["category"], PaymentGateDecision>> = {
  HAPPY_PATH: "UNLOCKED",
  MISSING_FIELD: "LOCKED",
  AMBIGUOUS_CONFIRMATION: "READY_FOR_CONFIRMATION",
  POLICY_NOT_CONFIRMED: "READY_FOR_CONFIRMATION",
  CUSTOMER_CHANGE: "READY_FOR_CONFIRMATION",
  CALL_DROPPED: "LOCKED",
  PAYMENT_MISMATCH: "MANUAL_REVIEW_REQUIRED",
  PROOF_MISMATCH: "MANUAL_REVIEW_REQUIRED"
};

const categoryReasonCodes: Partial<Record<EvaluationScenario["category"], string[]>> = {
  AMBIGUOUS_CONFIRMATION: ["AMBIGUOUS_CONFIRMATION"],
  POLICY_NOT_CONFIRMED: ["REFUND_POLICY_NOT_CONFIRMED"],
  CUSTOMER_CHANGE: ["CUSTOMER_CHANGED_TERMS"],
  CALL_DROPPED: ["CALL_DROPPED"],
  PAYMENT_MISMATCH: ["PAYMENT_AMOUNT_MISMATCH"],
  PROOF_MISMATCH: ["PROOF_MISMATCH"]
};

export function runMockEvaluation(
  scenario: EvaluationScenario
): EvaluationActual {
  const expected = scenario.expected;
  const gate =
    scenario.id === "payment-gate-should-stay-locked"
      ? "LOCKED"
      : categoryGate[scenario.category] ?? "LOCKED";

  return {
    extractedFields: expected.extractedFields ?? {},
    missingFields: [...expected.missingFields],
    paymentGate: gate,
    reasonCodes:
      expected.reasonCodes.length > 0
        ? [...expected.reasonCodes]
        : [...(categoryReasonCodes[scenario.category] ?? [])],
    shouldCreatePaymentIntent: gate === "UNLOCKED"
  };
}
