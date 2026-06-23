import { z } from "zod";

import { TranscriptTurnIdSchema } from "./primitives.js";

export const BookingExtractionFieldStatusSchema = z.enum([
  "PRESENT",
  "MISSING",
  "AMBIGUOUS",
  "INVALID"
]);

export const ExtractionEvidenceRefSchema = z
  .object({
    turnId: TranscriptTurnIdSchema,
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().nonnegative().optional()
  })
  .strict()
  .refine(
    (value) => value.start === undefined || value.end === undefined || value.end > value.start,
    "Evidence end must be greater than start."
  );

function extractedFieldCandidate<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      value: valueSchema.nullable(),
      confidence: z.number().min(0).max(1),
      status: BookingExtractionFieldStatusSchema,
      evidenceRefs: z.array(ExtractionEvidenceRefSchema).min(1)
    })
    .strict()
    .superRefine((value, context) => {
      const candidate = value as unknown as {
        value: z.infer<T> | null;
        status: z.infer<typeof BookingExtractionFieldStatusSchema>;
      };
      if (candidate.status === "PRESENT" && candidate.value === null) {
        context.addIssue({ code: "custom", message: "Present candidates require a value." });
      }
      if (candidate.status !== "PRESENT" && candidate.value !== null) {
        context.addIssue({ code: "custom", message: "Non-present candidates must use null." });
      }
    });
}

export const BookingExtractionCandidateSchema = z
  .object({
    schemaVersion: z.literal("ctc.booking-extraction.v1"),
    fields: z
      .object({
        origin: extractedFieldCandidate(z.string().min(1).max(120)).optional(),
        destination: extractedFieldCandidate(z.string().min(1).max(120)).optional(),
        departureDate: extractedFieldCandidate(z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)).optional(),
        departureTime: extractedFieldCandidate(z.string().regex(/^\d{2}:\d{2}$/u)).optional(),
        passengerCount: extractedFieldCandidate(z.number().int().positive().max(36)).optional(),
        pickupPoint: extractedFieldCandidate(z.string().min(1).max(200)).optional(),
        contactPhoneCandidate: extractedFieldCandidate(z.string().min(1).max(32)).optional(),
        customerNotes: extractedFieldCandidate(z.string().min(1).max(500)).optional()
      })
      .strict(),
    warnings: z.array(z.string().min(1).max(120)).max(20)
  })
  .strict();

export type BookingExtractionCandidate = z.infer<typeof BookingExtractionCandidateSchema>;
export type BookingExtractionFieldStatus = z.infer<typeof BookingExtractionFieldStatusSchema>;
export type ExtractionEvidenceRef = z.infer<typeof ExtractionEvidenceRefSchema>;
