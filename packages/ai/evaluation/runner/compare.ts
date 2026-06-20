import type { EvaluationScenario } from "../schemas/evaluation-scenario.schema.js";
import type {
  EvaluationActual,
  ScenarioEvaluationResult
} from "../schemas/evaluation-result.schema.js";

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameStringArray(left: string[], right: string[]): boolean {
  const leftSorted = sorted(left);
  const rightSorted = sorted(right);
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function expectedReasonCodesPresent(
  expected: string[],
  actual: string[]
): boolean {
  return expected.every((code) => actual.includes(code));
}

function findTurnsToAgreement(scenario: EvaluationScenario): number | undefined {
  const index = scenario.turns.findIndex(
    (turn) =>
      turn.speaker === "CUSTOMER" &&
      /\b(confirm|accept|agree|xac nhan|dong y)\b/i.test(turn.content)
  );
  return index >= 0 ? index + 1 : undefined;
}

export function compareEvaluation(
  scenario: EvaluationScenario,
  actual: EvaluationActual
): ScenarioEvaluationResult {
  const failures: string[] = [];
  const expected = scenario.expected;

  if (actual.paymentGate !== expected.paymentGate) {
    failures.push(
      `Expected paymentGate ${expected.paymentGate}, actual ${actual.paymentGate}`
    );
  }

  if (
    actual.shouldCreatePaymentIntent !== expected.shouldCreatePaymentIntent
  ) {
    failures.push(
      `Expected shouldCreatePaymentIntent ${expected.shouldCreatePaymentIntent}, actual ${actual.shouldCreatePaymentIntent}`
    );
  }

  if (!expectedReasonCodesPresent(expected.reasonCodes, actual.reasonCodes)) {
    failures.push(
      `Missing expected reason codes: ${expected.reasonCodes
        .filter((code) => !actual.reasonCodes.includes(code))
        .join(", ")}`
    );
  }

  if (!sameStringArray(expected.missingFields, actual.missingFields)) {
    failures.push(
      `Expected missingFields ${expected.missingFields.join(", ") || "none"}, actual ${
        actual.missingFields.join(", ") || "none"
      }`
    );
  }

  for (const [field, expectedValue] of Object.entries(
    expected.extractedFields ?? {}
  )) {
    const actualValue =
      actual.extractedFields[field as keyof typeof actual.extractedFields];
    if (actualValue !== expectedValue) {
      failures.push(
        `Expected extractedFields.${field} ${String(
          expectedValue
        )}, actual ${String(actualValue)}`
      );
    }
  }

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    category: scenario.category,
    turnCount: scenario.turns.length,
    turnsToAgreement: findTurnsToAgreement(scenario),
    passed: failures.length === 0,
    expected,
    actual,
    failures
  };
}
