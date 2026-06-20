import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { calculateMetrics } from "../metrics/calculate-metrics.js";
import { EvaluationScenarioSchema } from "../schemas/evaluation-scenario.schema.js";
import type { EvaluationScenario } from "../schemas/evaluation-scenario.schema.js";
import {
  EvaluationRunResultSchema,
  type EvaluationActual,
  type ScenarioEvaluationResult
} from "../schemas/evaluation-result.schema.js";
import { compareEvaluation } from "./compare.js";

const evaluationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scenariosDir = path.join(evaluationRoot, "scenarios");
const reportsDir = path.join(evaluationRoot, "reports");
const latestResultPath = path.join(reportsDir, "evaluation-result-latest.json");
const apiBaseUrl = process.env.API_BASE_URL;
const scenarioTimeoutMs = Number(process.env.EVAL_API_TIMEOUT_MS ?? 15000);

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type RiskResponse = {
  extractedFields?: EvaluationActual["extractedFields"];
  missingFields?: string[];
  paymentGate?: EvaluationActual["paymentGate"];
  reasonCodes?: string[];
  shouldCreatePaymentIntent?: boolean;
};

async function loadScenarios(): Promise<EvaluationScenario[]> {
  const entries = await readdir(scenariosDir, { withFileTypes: true });
  const scenarioFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(scenariosDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
  const scenarios: EvaluationScenario[] = [];

  for (const scenarioFile of scenarioFiles) {
    const raw = await readFile(scenarioFile, "utf8");
    scenarios.push(EvaluationScenarioSchema.parse(JSON.parse(raw)));
  }

  return scenarios;
}

async function requestJson<T>(
  url: string,
  options: RequestInit,
  signal: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.success === false || body.data === undefined) {
    throw new Error(
      body.error?.message ?? `Request failed with status ${response.status}`
    );
  }

  return body.data;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollRisk(
  callId: string,
  signal: AbortSignal
): Promise<RiskResponse> {
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is required");
  }

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await requestJson<RiskResponse>(
        `${apiBaseUrl}/v1/calls/${callId}/risk`,
        { method: "GET" },
        signal
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      if (attempt < 5) {
        await delay(1000);
      }
    }
  }

  throw lastError ?? new Error("Risk polling failed");
}

function mapRiskToActual(risk: RiskResponse): EvaluationActual {
  return {
    extractedFields: risk.extractedFields ?? {},
    missingFields: risk.missingFields ?? [],
    paymentGate: risk.paymentGate ?? "LOCKED",
    reasonCodes: risk.reasonCodes ?? [],
    shouldCreatePaymentIntent:
      risk.shouldCreatePaymentIntent ?? risk.paymentGate === "UNLOCKED"
  };
}

async function runScenarioAgainstApi(
  scenario: EvaluationScenario
): Promise<ScenarioEvaluationResult> {
  if (!apiBaseUrl) {
    throw new Error(
      "Set API_BASE_URL, for example API_BASE_URL=http://localhost:3000, before running eval:api."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), scenarioTimeoutMs);

  try {
    const call = await requestJson<{ callId: string }>(
      `${apiBaseUrl}/v1/calls`,
      {
        method: "POST",
        body: JSON.stringify({
          channelPurpose: "BOOKING",
          sourceMode: "EVALUATION_REPLAY"
        })
      },
      controller.signal
    );

    for (const [index, turn] of scenario.turns.entries()) {
      await requestJson<unknown>(
        `${apiBaseUrl}/v1/transcripts/turns`,
        {
          method: "POST",
          body: JSON.stringify({
            callId: call.callId,
            turn: {
              clientTurnId: `${scenario.id}-${index + 1}`,
              sequenceNo: index + 1,
              speaker: turn.speaker,
              content: turn.content,
              language: "en-US",
              isFinal: true,
              source: "EVALUATION"
            }
          })
        },
        controller.signal
      );
    }

    await requestJson<unknown>(
      `${apiBaseUrl}/v1/risk/analyze`,
      {
        method: "POST",
        body: JSON.stringify({
          callId: call.callId,
          mode: "LATEST_FINAL_TURNS"
        })
      },
      controller.signal
    );

    const risk = await pollRisk(call.callId, controller.signal);
    return compareEvaluation(scenario, mapRiskToActual(risk));
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  if (!apiBaseUrl) {
    console.error(
      "API_BASE_URL is not set. Start the API and run: API_BASE_URL=http://localhost:3000 pnpm eval:api"
    );
    process.exitCode = 1;
    return;
  }

  const scenarios = await loadScenarios();
  const results: ScenarioEvaluationResult[] = [];

  console.log(`Running ${scenarios.length} scenarios against ${apiBaseUrl}...`);
  for (const scenario of scenarios) {
    try {
      const result = await runScenarioAgainstApi(scenario);
      results.push(result);
      console.log(`${result.passed ? "PASS" : "FAIL"} ${result.scenarioId}`);
      for (const failure of result.failures) {
        console.log(`  ${failure}`);
      }
    } catch (error) {
      console.log(`FAIL ${scenario.id}`);
      console.log(
        `  ${error instanceof Error ? error.message : "Unknown API error"}`
      );
      process.exitCode = 1;
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

  if (metrics.gateFalseUnlockRate > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
