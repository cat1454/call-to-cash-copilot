import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { calculateMetrics } from "../metrics/calculate-metrics.js";
import { EvaluationScenarioSchema } from "../schemas/evaluation-scenario.schema.js";
import { EvaluationRunResultSchema } from "../schemas/evaluation-result.schema.js";
import type { ScenarioEvaluationResult } from "../schemas/evaluation-result.schema.js";
import { compareEvaluation } from "./compare.js";
import { runMockEvaluation } from "./mock-evaluator.js";

const evaluationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scenariosDir = path.join(evaluationRoot, "scenarios");
const reportsDir = path.join(evaluationRoot, "reports");
const latestResultPath = path.join(reportsDir, "evaluation-result-latest.json");

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function loadScenarioFiles(): Promise<string[]> {
  const entries = await readdir(scenariosDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(scenariosDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function main(): Promise<void> {
  const scenarioFiles = await loadScenarioFiles();
  const results: ScenarioEvaluationResult[] = [];
  let invalidScenarios = 0;
  let runtimeErrors = 0;

  console.log(`Running ${scenarioFiles.length} scenarios...`);

  for (const scenarioFile of scenarioFiles) {
    const raw = await readFile(scenarioFile, "utf8");
    const parsedJson = JSON.parse(raw) as unknown;
    const parsedScenario = EvaluationScenarioSchema.safeParse(parsedJson);
    const displayId =
      typeof parsedJson === "object" &&
      parsedJson !== null &&
      "id" in parsedJson &&
      typeof parsedJson.id === "string"
        ? parsedJson.id
        : path.basename(scenarioFile, ".json");

    if (!parsedScenario.success) {
      invalidScenarios += 1;
      console.log(`FAIL ${displayId}`);
      console.log(`  Invalid scenario: ${parsedScenario.error.message}`);
      continue;
    }

    try {
      const actual = runMockEvaluation(parsedScenario.data);
      const result = compareEvaluation(parsedScenario.data, actual);
      results.push(result);

      console.log(`${result.passed ? "PASS" : "FAIL"} ${result.scenarioId}`);
      for (const failure of result.failures) {
        console.log(`  ${failure}`);
      }
    } catch (error) {
      runtimeErrors += 1;
      console.log(`FAIL ${displayId}`);
      console.log(
        `  Runtime error: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  const metrics = calculateMetrics(results);
  const runResult = EvaluationRunResultSchema.parse({
    schemaVersion: "evaluation-result-v1",
    generatedAt: new Date().toISOString(),
    results,
    metrics
  });

  await mkdir(reportsDir, { recursive: true });
  await writeFile(latestResultPath, `${JSON.stringify(runResult, null, 2)}\n`);

  console.log("Summary:");
  console.log(`Total: ${metrics.totalScenarios}`);
  console.log(`Passed: ${metrics.passedScenarios}`);
  console.log(`Failed: ${metrics.failedScenarios}`);
  console.log(`Invalid: ${invalidScenarios}`);
  console.log(`Runtime errors: ${runtimeErrors}`);
  console.log(`Gate false unlock: ${formatRate(metrics.gateFalseUnlockRate)}`);
  console.log(`Gate false lock: ${formatRate(metrics.gateFalseLockRate)}`);
  console.log(
    `Field extraction accuracy: ${formatRate(
      metrics.fieldExtractionAccuracy
    )}`
  );

  if (
    invalidScenarios > 0 ||
    runtimeErrors > 0 ||
    metrics.gateFalseUnlockRate > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
