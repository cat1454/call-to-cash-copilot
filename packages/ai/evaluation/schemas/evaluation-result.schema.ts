import { z } from "zod";

import {
  EvaluationCategorySchema,
  EvaluationExpectedSchema,
  ExtractedFieldsSchema,
  PaymentGateDecisionSchema
} from "./evaluation-scenario.schema.js";

export const EvaluationActualSchema = z.object({
  extractedFields: ExtractedFieldsSchema,
  missingFields: z.array(z.string().min(1)),
  paymentGate: PaymentGateDecisionSchema,
  reasonCodes: z.array(z.string().min(1)),
  shouldCreatePaymentIntent: z.boolean()
});

export const ScenarioEvaluationResultSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  category: EvaluationCategorySchema,
  turnCount: z.number().int().positive(),
  turnsToAgreement: z.number().int().positive().optional(),
  passed: z.boolean(),
  expected: EvaluationExpectedSchema,
  actual: EvaluationActualSchema,
  failures: z.array(z.string())
});

export const EvaluationMetricsSchema = z.object({
  totalScenarios: z.number().int().nonnegative(),
  passedScenarios: z.number().int().nonnegative(),
  failedScenarios: z.number().int().nonnegative(),
  fieldExtractionAccuracy: z.number().min(0).max(1),
  gateFalseUnlockRate: z.number().min(0).max(1),
  gateFalseLockRate: z.number().min(0).max(1),
  reasonCodeMatchRate: z.number().min(0).max(1),
  paymentMismatchDetectionRate: z.number().min(0).max(1),
  proofMismatchDetectionRate: z.number().min(0).max(1),
  averageTurnsToAgreement: z.number().nonnegative()
});

export const EvaluationRunResultSchema = z.object({
  schemaVersion: z.literal("evaluation-result-v1"),
  generatedAt: z.string().datetime(),
  results: z.array(ScenarioEvaluationResultSchema),
  metrics: EvaluationMetricsSchema
});

export type EvaluationActual = z.infer<typeof EvaluationActualSchema>;
export type ScenarioEvaluationResult = z.infer<
  typeof ScenarioEvaluationResultSchema
>;
export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;
export type EvaluationRunResult = z.infer<typeof EvaluationRunResultSchema>;
