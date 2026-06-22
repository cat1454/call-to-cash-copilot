import { createHash } from "node:crypto";

import { z } from "zod";

const InternalTranscriptFrameSchema = z
  .object({
    type: z.literal("ctc.transcript.final/v1"),
    eventId: z.string().min(1).max(128),
    callId: z.string().regex(/^call_[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/u),
    channelName: z.string().min(1).max(64),
    sessionId: z.string().min(1).max(256),
    occurredAt: z.string().datetime({ offset: true }),
    turn: z
      .object({
        id: z.string().min(1).max(128),
        sequenceNo: z.number().int().positive(),
        speaker: z.enum(["CUSTOMER", "AGENT"]),
        text: z.string().min(1).max(10_000),
        language: z.string().min(1).max(35).default("vi-VN"),
        final: z.literal(true),
        startedAt: z.string().datetime({ offset: true }).optional(),
        endedAt: z.string().datetime({ offset: true }).optional(),
        confidence: z.number().min(0).max(1).optional()
      })
      .strict()
  })
  .strict();

const AgoraTranscriptionBaseSchema = z.object({
  text: z.string().max(10_000),
  start_ms: z.number().nonnegative().optional(),
  duration_ms: z.number().nonnegative().optional(),
  language: z.string().min(1).max(35).default("vi-VN"),
  turn_id: z.number().int().nonnegative().optional(),
  stream_id: z.number().int().nonnegative().optional(),
  user_id: z.string().min(1).optional(),
  words: z.array(z.unknown()).nullable().optional().default(null)
});

const AgoraCustomerTranscriptionSchema = AgoraTranscriptionBaseSchema.extend({
  object: z.literal("user.transcription"),
  final: z.boolean()
}).passthrough();

const AgoraAgentTranscriptionSchema = AgoraTranscriptionBaseSchema.extend({
  object: z.literal("assistant.transcription"),
  turn_status: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional()
}).passthrough();

const AgoraTranscriptionSchema = z.discriminatedUnion("object", [
  AgoraCustomerTranscriptionSchema,
  AgoraAgentTranscriptionSchema
]);

export type RtmTranscriptFrame = z.infer<typeof InternalTranscriptFrameSchema>;
export type RtmTranscriptBinding = {
  callId: string;
  channelName: string;
  sessionId: string;
  agentUid: number;
};

type JsonRecord = Record<string, unknown>;
export type AssistantTextSource = "direct" | "alternate" | "missing" | "nonString";

export type ParseRtmTranscriptFrameResult =
  | { accepted: true; event: RtmTranscriptFrame }
  | {
      accepted: false;
      reason:
        | "MALFORMED"
        | "PARTIAL"
        | "PUBLISHER_MISMATCH"
        | "CALL_MISMATCH"
        | "CHANNEL_MISMATCH"
        | "SESSION_MISMATCH"
        | "SESSION_PENDING";
    };

function stableId(
  binding: RtmTranscriptBinding,
  message: z.infer<typeof AgoraTranscriptionSchema>
) {
  const digest = createHash("sha256")
    .update(
      [
        binding.callId,
        binding.sessionId,
        message.object,
        message.turn_id ?? message.start_ms ?? "unknown-turn",
        message.stream_id ?? "unknown-stream",
        message.user_id ?? "unknown-user"
      ].join(":"),
      "utf8"
    )
    .digest("hex")
    .slice(0, 32);
  return `agora-rtm-${digest}`;
}

function parseJson(rawMessage: unknown): unknown | undefined {
  if (typeof rawMessage !== "string") return undefined;
  try {
    return JSON.parse(rawMessage) as unknown;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function alternateAssistantText(payload: JsonRecord): string | undefined {
  const nested = asRecord(payload.data);
  for (const candidate of [
    payload.content,
    payload.transcript,
    payload.message,
    nested?.text,
    nested?.content
  ]) {
    if (typeof candidate === "string") return candidate;
  }
  return undefined;
}

export function assistantTextSource(payload: unknown): AssistantTextSource | undefined {
  const record = asRecord(payload);
  if (record?.object !== "assistant.transcription") return undefined;
  if (typeof record.text === "string") return "direct";
  if (alternateAssistantText(record) !== undefined) return "alternate";
  return record.text === undefined ? "missing" : "nonString";
}

function normalizeAssistantPayload(payload: unknown): unknown {
  const record = asRecord(payload);
  if (record?.object !== "assistant.transcription" || typeof record.text === "string") {
    return payload;
  }
  const text = alternateAssistantText(record);
  return text === undefined ? payload : { ...record, text };
}

export function parseRtmTranscriptFrame(
  rawMessage: unknown,
  publisher: unknown,
  binding: RtmTranscriptBinding,
  now = new Date()
): ParseRtmTranscriptFrameResult {
  if (String(publisher) !== String(binding.agentUid)) {
    return { accepted: false, reason: "PUBLISHER_MISMATCH" };
  }
  const payload = parseJson(rawMessage);
  if (payload === undefined) return { accepted: false, reason: "MALFORMED" };

  // Backward compatibility for a custom pipeline that already emits the internal frame.
  const internal = InternalTranscriptFrameSchema.safeParse(payload);
  if (internal.success) {
    if (internal.data.callId !== binding.callId)
      return { accepted: false, reason: "CALL_MISMATCH" };
    if (internal.data.channelName !== binding.channelName) {
      return { accepted: false, reason: "CHANNEL_MISMATCH" };
    }
    if (internal.data.sessionId !== binding.sessionId && binding.sessionId !== "PENDING_AGENT") {
      return { accepted: false, reason: "SESSION_MISMATCH" };
    }
    return { accepted: true, event: internal.data };
  }

  const transcription = AgoraTranscriptionSchema.safeParse(normalizeAssistantPayload(payload));
  if (!transcription.success) return { accepted: false, reason: "MALFORMED" };
  if (binding.sessionId === "PENDING_AGENT") {
    return { accepted: false, reason: "SESSION_PENDING" };
  }

  const isCustomer = transcription.data.object === "user.transcription";
  const isFinal = isCustomer
    ? transcription.data.final
    : transcription.data.turn_status === undefined
      ? transcription.data.words === null || transcription.data.words.length === 0
      : transcription.data.turn_status !== 0;
  const text = transcription.data.text.trim();
  if (!isFinal || text.length === 0) return { accepted: false, reason: "PARTIAL" };

  const id = stableId(binding, transcription.data);
  const sequenceNo = Math.max(1, (transcription.data.turn_id ?? 0) * 2 + (isCustomer ? 1 : 2));
  return {
    accepted: true,
    event: {
      type: "ctc.transcript.final/v1",
      eventId: id,
      callId: binding.callId,
      channelName: binding.channelName,
      sessionId: binding.sessionId,
      occurredAt: now.toISOString(),
      turn: {
        id,
        sequenceNo,
        speaker: isCustomer ? "CUSTOMER" : "AGENT",
        text,
        language: transcription.data.language,
        final: true
      }
    }
  };
}
