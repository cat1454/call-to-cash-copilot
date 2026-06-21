import { z } from "zod";

export const AgoraTranscriptProviderEventSchema = z
  .object({
    type: z.literal("transcript.turn"),
    eventId: z.string().min(1),
    callId: z.string().regex(/^call_[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/u),
    channelName: z.string().min(1).max(64),
    sessionId: z.string().min(1),
    occurredAt: z.string().datetime({ offset: true }),
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
