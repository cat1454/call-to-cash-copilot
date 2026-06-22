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

/** The documented Agora Notifications event 103 post-session history envelope. */
export const AgoraConversationHistoryNotificationSchema = z
  .object({
    noticeId: z.string().min(1),
    productId: z.literal(17),
    eventType: z.literal(103),
    notifyMs: z.number().int().positive(),
    sid: z.string().min(1),
    payload: z
      .object({
        labels: z
          .object({ call_id: z.string().min(1), schema_version: z.literal("ctc-v1") })
          .strict(),
        agent_id: z.string().min(1),
        name: z.string().min(1),
        channel: z.string().min(1).max(64),
        start_ts: z.number().nonnegative(),
        stop_ts: z.number().nonnegative(),
        contents: z.array(
          z
            .object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(10_000),
              speech_start_ms: z.number().int().nonnegative().optional(),
              speech_end_ms: z.number().int().nonnegative().optional(),
              speech_algorithmic_delay: z.number().int().nonnegative().optional()
            })
            .strict()
        )
      })
      .strict()
  })
  .strict();

export type AgoraConversationHistoryNotification = z.infer<
  typeof AgoraConversationHistoryNotificationSchema
>;
