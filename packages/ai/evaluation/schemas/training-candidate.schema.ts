import { z } from "zod";

export const TrainingCandidateSchema = z
  .object({
    id: z.string().min(1),
    callId: z.string().min(1),
    bookingId: z.string().min(1),
    redactedTranscriptUri: z.string().min(1),
    trainingConsent: z.boolean(),
    piiRedacted: z.boolean(),
    outcomeLabel: z.enum([
      "COMPLETED_SUCCESSFULLY",
      "CUSTOMER_CANCELLED",
      "DEPOSIT_REFUNDED",
      "DISPUTE_OPENED",
      "PAYMENT_ANOMALY",
      "INCONCLUSIVE"
    ]),
    labelStatus: z.enum(["PENDING", "REVIEWED", "APPROVED", "REJECTED"]),
    reviewerId: z.string().min(1).optional(),
    createdAt: z.string().datetime()
  })
  .strict();

export type TrainingCandidate = z.infer<typeof TrainingCandidateSchema>;

export function isEligibleForTraining(candidate: TrainingCandidate): boolean {
  return (
    candidate.trainingConsent === true &&
    candidate.piiRedacted === true &&
    candidate.outcomeLabel !== "INCONCLUSIVE" &&
    candidate.labelStatus === "APPROVED"
  );
}
