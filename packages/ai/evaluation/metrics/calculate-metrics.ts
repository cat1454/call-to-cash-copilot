import type { ScenarioEvaluationResult } from "../schemas/evaluation-result.schema.js";

function safeRate(numerator: number, denominator: number, emptyValue = 0): number {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

function overlapCount(left: string[], right: string[]): number {
  return left.filter((value) => right.includes(value)).length;
}

function detectsPaymentMismatch(result: ScenarioEvaluationResult): boolean {
  return (
    result.actual.paymentGate === "MANUAL_REVIEW_REQUIRED" ||
    result.actual.reasonCodes.some((code) =>
      [
        "PAYMENT_AMOUNT_MISMATCH",
        "PAYMENT_REFERENCE_MISMATCH",
        "PAYMENT_RECIPIENT_MISMATCH"
      ].includes(code)
    )
  );
}

function detectsProofMismatch(result: ScenarioEvaluationResult): boolean {
  return (
    result.actual.paymentGate === "MANUAL_REVIEW_REQUIRED" ||
    result.actual.reasonCodes.includes("PROOF_MISMATCH")
  );
}

export function calculateMetrics(results: ScenarioEvaluationResult[]) {
  const totalScenarios = results.length;
  const passedScenarios = results.filter((result) => result.passed).length;
  const failedScenarios = totalScenarios - passedScenarios;

  let expectedFieldCount = 0;
  let correctFieldCount = 0;
  let expectedReasonCodeCount = 0;
  let matchingReasonCodeCount = 0;

  for (const result of results) {
    for (const [field, expectedValue] of Object.entries(
      result.expected.extractedFields ?? {}
    )) {
      expectedFieldCount += 1;
      const actualValue =
        result.actual.extractedFields[
          field as keyof typeof result.actual.extractedFields
        ];
      if (actualValue === expectedValue) {
        correctFieldCount += 1;
      }
    }

    expectedReasonCodeCount += result.expected.reasonCodes.length;
    matchingReasonCodeCount += overlapCount(
      result.expected.reasonCodes,
      result.actual.reasonCodes
    );
  }

  const expectedLockedCases = results.filter(
    (result) => result.expected.shouldCreatePaymentIntent === false
  );
  const falseUnlockCount = expectedLockedCases.filter(
    (result) => result.actual.shouldCreatePaymentIntent === true
  ).length;

  const expectedUnlockedCases = results.filter(
    (result) => result.expected.shouldCreatePaymentIntent === true
  );
  const falseLockCount = expectedUnlockedCases.filter(
    (result) => result.actual.shouldCreatePaymentIntent === false
  ).length;

  const paymentMismatchCases = results.filter(
    (result) => result.category === "PAYMENT_MISMATCH"
  );
  const proofMismatchCases = results.filter(
    (result) => result.category === "PROOF_MISMATCH"
  );
  const agreementTurnCounts = results
    .map((result) => result.turnsToAgreement)
    .filter((value): value is number => typeof value === "number");

  return {
    totalScenarios,
    passedScenarios,
    failedScenarios,
    fieldExtractionAccuracy: safeRate(correctFieldCount, expectedFieldCount, 1),
    gateFalseUnlockRate: safeRate(
      falseUnlockCount,
      expectedLockedCases.length
    ),
    gateFalseLockRate: safeRate(falseLockCount, expectedUnlockedCases.length),
    reasonCodeMatchRate: safeRate(
      matchingReasonCodeCount,
      expectedReasonCodeCount,
      1
    ),
    paymentMismatchDetectionRate: safeRate(
      paymentMismatchCases.filter(detectsPaymentMismatch).length,
      paymentMismatchCases.length,
      1
    ),
    proofMismatchDetectionRate: safeRate(
      proofMismatchCases.filter(detectsProofMismatch).length,
      proofMismatchCases.length,
      1
    ),
    averageTurnsToAgreement: safeRate(
      agreementTurnCounts.reduce((sum, value) => sum + value, 0),
      agreementTurnCounts.length
    )
  };
}
