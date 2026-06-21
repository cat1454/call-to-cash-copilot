import { z } from "zod";

export const AgoraTranscriptProviderEventSchema = z
  .object({
    type: z.literal("transcript.turn"),
    eventId: z.string().min(1),
    turn: z
      .object({
        id: z.string().min(1),
        sequenceNo: z.number().int().positive(),
        speaker: z.enum(["CUSTOMER", "AGENT", "OPERATOR", "SYSTEM"]),
        text: z.string().min(1),
        language: z.string().min(1).default("vi-VN"),
        final: z.boolean(),
        startedAt: z.string().datetime({ offset: true }).optional(),
        endedAt: z.string().datetime({ offset: true }).optional(),
        confidence: z.number().min(0).max(1).optional()
      })
      .strict()
  })
  .strict();

export type AgoraTranscriptProviderEvent = z.infer<typeof AgoraTranscriptProviderEventSchema>;
