import { createHash } from "node:crypto";

import { normalizeTranscriptDisplayText } from "@call-to-cash/shared";
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
  turn_status: z.unknown().optional()
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
  message: {
    object: string;
    turn_id?: unknown;
    start_ms?: unknown;
    stream_id?: unknown;
    user_id?: unknown;
  }
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

function safeLanguage(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 35
    ? value
    : "vi-VN";
}

function safeTurnId(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
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

function numericField(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function turnStatusField(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized === "0" || normalized === "partial" || normalized === "in_progress") return 0;
  if (normalized === "1" || normalized === "final" || normalized === "complete") return 1;
  if (normalized === "2" || normalized === "completed" || normalized === "terminal") return 2;
  return value;
}

function normalizeTranscriptPayload(payload: unknown): unknown {
  const record = asRecord(payload);
  if (record === undefined) return payload;

  const normalized: JsonRecord = { ...record };
  normalized.start_ms = numericField(normalized.start_ms);
  normalized.duration_ms = numericField(normalized.duration_ms);
  normalized.turn_id = numericField(normalized.turn_id);
  normalized.stream_id = numericField(normalized.stream_id);

  if (typeof normalized.user_id === "number") normalized.user_id = String(normalized.user_id);
  if (typeof normalized.user_id !== "string") delete normalized.user_id;
  if (typeof normalized.language !== "string" || normalized.language.trim().length === 0) {
    delete normalized.language;
  }
  if (normalized.words !== undefined && normalized.words !== null && !Array.isArray(normalized.words)) {
    normalized.words = null;
  }
  if (normalized.object === "assistant.transcription") {
    normalized.turn_status = turnStatusField(normalized.turn_status);
    if (typeof normalized.text !== "string") {
      const text = alternateAssistantText(normalized);
      if (text !== undefined) normalized.text = text;
    }
  }

  return normalized;
}

function alternateAssistantText(payload: JsonRecord): string | undefined {
  const nested = asRecord(payload.data);
  for (const candidate of [
    payload.content,
    payload.transcript,
    payload.message,
    nested?.text,
    nested?.content,
    nested?.transcript,
    nested?.message
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
    return {
      accepted: true,
      event: {
        ...internal.data,
        turn: {
          ...internal.data.turn,
          text: normalizeTranscriptDisplayText(internal.data.turn.text)
        }
      }
    };
  }

  const normalizedPayload = normalizeTranscriptPayload(payload);
  const normalizedRecord = asRecord(normalizedPayload);
  if (normalizedRecord?.object === "assistant.transcription") {
    if (binding.sessionId === "PENDING_AGENT") {
      return { accepted: false, reason: "SESSION_PENDING" };
    }
    const text = normalizeTranscriptDisplayText(
      typeof normalizedRecord.text === "string" ? normalizedRecord.text : ""
    );
    if (text.length === 0) return { accepted: false, reason: "PARTIAL" };

    const id = stableId(binding, {
      object: "assistant.transcription",
      turn_id: normalizedRecord.turn_id,
      start_ms: normalizedRecord.start_ms,
      stream_id: normalizedRecord.stream_id,
      user_id: normalizedRecord.user_id
    });
    const turnId = safeTurnId(normalizedRecord.turn_id);
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
          sequenceNo: Math.max(1, (turnId ?? 0) * 2 + 2),
          speaker: "AGENT",
          text,
          language: safeLanguage(normalizedRecord.language),
          final: true
        }
      }
    };
  }

  const transcription = AgoraTranscriptionSchema.safeParse(normalizedPayload);
  if (!transcription.success) return { accepted: false, reason: "MALFORMED" };
  if (binding.sessionId === "PENDING_AGENT") {
    return { accepted: false, reason: "SESSION_PENDING" };
  }

  const isCustomer = transcription.data.object === "user.transcription";
  const isFinal = isCustomer
    ? transcription.data.final
    : transcription.data.turn_status === undefined
      ? true
      : transcription.data.turn_status !== 0;
  const text = normalizeTranscriptDisplayText(transcription.data.text);
  if (text.length === 0) return { accepted: false, reason: "PARTIAL" };
  if (isCustomer && !isFinal) return { accepted: false, reason: "PARTIAL" };

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
