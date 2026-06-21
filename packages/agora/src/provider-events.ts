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

/**
 * The public Agora Notifications endpoint accepts only post-session history
 * notifications. The permissive field aliases accommodate Agora's documented
 * envelope variants while the application still validates the resolved facts.
 */
export const AgoraConversationHistoryNotificationSchema = z
  .object({
    noticeId: z.string().min(1),
    productId: z.union([z.string().min(1), z.number().int()]),
    eventType: z.union([z.literal(103), z.literal("103")]),
    notifyMs: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    payload: z
      .object({
        labels: z.object({ call_id: z.string().min(1), schema_version: z.literal("ctc-v1") }).strict(),
        channelName: z.string().min(1).max(64),
        sessionId: z.string().min(1),
        history: z.array(
          z.object({
            id: z.string().min(1),
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1),
            isFinal: z.boolean().optional().default(true),
            occurredAt: z.string().datetime({ offset: true }).optional(),
            sequenceNo: z.number().int().positive().optional(),
            language: z.string().min(1).optional()
          }).strict()
        )
      })
      .strict()
  })
  .strict();

export type AgoraConversationHistoryNotification = z.infer<
  typeof AgoraConversationHistoryNotificationSchema
>;
