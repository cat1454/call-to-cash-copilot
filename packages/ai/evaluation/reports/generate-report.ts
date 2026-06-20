import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvaluationRunResultSchema,
  type ScenarioEvaluationResult
} from "../schemas/evaluation-result.schema.js";

const reportsDir = path.dirname(fileURLToPath(import.meta.url));
const latestResultPath = path.join(reportsDir, "evaluation-result-latest.json");
const latestReportPath = path.join(reportsDir, "evaluation-report-latest.md");

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function recommendFix(result: ScenarioEvaluationResult): string {
  if (
    result.expected.shouldCreatePaymentIntent === false &&
    result.actual.shouldCreatePaymentIntent === true
  ) {
    return "Fix explicit confirmation and payment-gate guards so the gate cannot open without current agreement evidence.";
  }

  if (
    result.failures.some(
      (failure) =>
        failure.includes("missingFields") ||
        failure.includes("extractedFields")
    )
  ) {
    return "Fix extraction and missing-field rules for this scenario category.";
  }

  if (result.failures.some((failure) => failure.includes("reason codes"))) {
    return "Fix reason-code mapping so every gate decision is backed by the expected safety code.";
  }

  if (
    ["PAYMENT_MISMATCH", "PROOF_MISMATCH"].includes(result.category) &&
    result.actual.paymentGate !== "MANUAL_REVIEW_REQUIRED"
  ) {
    return "Route payment or proof mismatch cases to MANUAL_REVIEW_REQUIRED.";
  }

  return "Review expected versus actual gate output and align deterministic evaluator behavior with product contracts.";
}

async function main(): Promise<void> {
  const raw = await readFile(latestResultPath, "utf8");
  const runResult = EvaluationRunResultSchema.parse(JSON.parse(raw));
  const failedResults = runResult.results.filter((result) => !result.passed);

  const lines = [
    "# Call-to-Cash Evaluation Report",
    "",
    "## Summary",
    `- Total scenarios: ${runResult.metrics.totalScenarios}`,
    `- Passed: ${runResult.metrics.passedScenarios}`,
    `- Failed: ${runResult.metrics.failedScenarios}`,
    `- Gate false unlock: ${percent(runResult.metrics.gateFalseUnlockRate)}`,
    `- Gate false lock: ${percent(runResult.metrics.gateFalseLockRate)}`,
    `- Field extraction accuracy: ${percent(
      runResult.metrics.fieldExtractionAccuracy
    )}`,
    `- Reason code match rate: ${percent(
      runResult.metrics.reasonCodeMatchRate
    )}`,
    `- Payment mismatch detection: ${percent(
      runResult.metrics.paymentMismatchDetectionRate
    )}`,
    `- Proof mismatch detection: ${percent(
      runResult.metrics.proofMismatchDetectionRate
    )}`,
    "",
    "## Safety Gate",
    runResult.metrics.gateFalseUnlockRate > 0
      ? "CRITICAL: Payment gate opened incorrectly. This must be fixed before demo."
      : "PASS: No false payment unlock detected.",
    "",
    "## Failed Scenarios"
  ];

  if (failedResults.length === 0) {
    lines.push("", "None.");
  }

  for (const result of failedResults) {
    lines.push(
      "",
      `### ${result.scenarioId}`,
      `- Title: ${result.title}`,
      `- Category: ${result.category}`,
      `- Expected paymentGate: ${result.expected.paymentGate}`,
      `- Actual paymentGate: ${result.actual.paymentGate}`,
      `- Expected reasonCodes: ${
        result.expected.reasonCodes.join(", ") || "none"
      }`,
      `- Actual reasonCodes: ${result.actual.reasonCodes.join(", ") || "none"}`,
      `- Failure messages: ${result.failures.join("; ")}`,
      `- Fix recommendation: ${recommendFix(result)}`
    );
  }

  await writeFile(latestReportPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), latestReportPath)}`);

  if (runResult.metrics.gateFalseUnlockRate > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
