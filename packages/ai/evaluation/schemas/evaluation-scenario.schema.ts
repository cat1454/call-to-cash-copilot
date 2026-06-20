import { z } from "zod";

export const EvaluationCategorySchema = z.enum([
  "HAPPY_PATH",
  "MISSING_FIELD",
  "AMBIGUOUS_CONFIRMATION",
  "POLICY_NOT_CONFIRMED",
  "CUSTOMER_CHANGE",
  "CALL_DROPPED",
  "PAYMENT_MISMATCH",
  "PROOF_MISMATCH"
]);

export const PaymentGateDecisionSchema = z.enum([
  "LOCKED",
  "READY_FOR_CONFIRMATION",
  "UNLOCKED",
  "MANUAL_REVIEW_REQUIRED"
]);

export const EvaluationTurnSchema = z.object({
  speaker: z.enum(["CUSTOMER", "AGENT", "OPERATOR", "SYSTEM"]),
  content: z.string().min(1)
});

export const ExtractedFieldsSchema = z
  .object({
    routeFrom: z.string().min(1).optional(),
    routeTo: z.string().min(1).optional(),
    passengerCount: z.number().int().positive().optional(),
    departureAt: z.string().min(1).optional(),
    pickupPoint: z.string().min(1).optional(),
    refundPolicyConfirmed: z.boolean().optional(),
    explicitConfirmation: z.boolean().optional()
  })
  .strict();

export const EvaluationExpectedSchema = z.object({
  extractedFields: ExtractedFieldsSchema.optional(),
  missingFields: z.array(z.string().min(1)),
  paymentGate: PaymentGateDecisionSchema,
  reasonCodes: z.array(z.string().min(1)),
  shouldCreatePaymentIntent: z.boolean()
});

export const EvaluationScenarioSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    category: EvaluationCategorySchema,
    turns: z.array(EvaluationTurnSchema).nonempty(),
    expected: EvaluationExpectedSchema
  })
  .strict();

export type EvaluationCategory = z.infer<typeof EvaluationCategorySchema>;
export type PaymentGateDecision = z.infer<typeof PaymentGateDecisionSchema>;
export type EvaluationTurn = z.infer<typeof EvaluationTurnSchema>;
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;
export type EvaluationExpected = z.infer<typeof EvaluationExpectedSchema>;
export type EvaluationScenario = z.infer<typeof EvaluationScenarioSchema>;
