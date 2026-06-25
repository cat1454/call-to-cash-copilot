import assert from "node:assert/strict";
import test from "node:test";

import { parseRtmTranscriptFrame } from "./rtm-transcript-frame.js";

const binding = {
  callId: "call_123456",
  channelName: "call_123456",
  sessionId: "agent-session-1",
  agentUid: 9001
};

test("accepts a final transcript frame bound to the active agent session", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      type: "ctc.transcript.final/v1",
      eventId: "rtm-event-1",
      callId: binding.callId,
      channelName: binding.channelName,
      sessionId: binding.sessionId,
      occurredAt: "2026-06-22T10:00:00.000Z",
      turn: {
        id: "turn-1",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        text: "Tôi muốn đi Sa Pa.",
        language: "vi-VN",
        final: true
      }
    }),
    "9001",
    binding
  );

  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.event.turn.id, "turn-1");
});

test("rejects an RTM message from a publisher other than the configured agent", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      type: "ctc.transcript.final/v1",
      eventId: "rtm-event-1",
      callId: binding.callId,
      channelName: binding.channelName,
      sessionId: binding.sessionId,
      occurredAt: "2026-06-22T10:00:00.000Z",
      turn: {
        id: "turn-1",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        text: "ignored",
        language: "vi-VN",
        final: true
      }
    }),
    "9003",
    binding
  );

  assert.deepEqual(result, { accepted: false, reason: "PUBLISHER_MISMATCH" });
});

test("rejects partial or cross-session RTM frames", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      type: "ctc.transcript.final/v1",
      eventId: "rtm-event-1",
      callId: binding.callId,
      channelName: binding.channelName,
      sessionId: "another-session",
      occurredAt: "2026-06-22T10:00:00.000Z",
      turn: {
        id: "turn-1",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        text: "ignored",
        language: "vi-VN",
        final: true
      }
    }),
    "9001",
    binding
  );

  assert.deepEqual(result, { accepted: false, reason: "SESSION_MISMATCH" });
});

test("accepts a documented final customer transcription from Agora", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "user.transcription",
      text: "Tôi muốn đi Sa Pa.",
      start_ms: 1000,
      duration_ms: 1200,
      language: "vi-VN",
      turn_id: 1,
      stream_id: 42,
      user_id: "customer-1",
      words: null,
      final: true
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:00.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) {
    assert.equal(result.event.turn.speaker, "CUSTOMER");
    assert.equal(result.event.turn.text, "Tôi muốn đi Sa Pa.");
  }
});

test("normalizes documented Agora transcript text before forwarding", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "user.transcription",
      text: "Dạ,   em muốn , đặt ba chỗ .",
      start_ms: 1000,
      duration_ms: 1200,
      language: "vi-VN",
      turn_id: 1,
      stream_id: 42,
      user_id: "customer-1",
      words: null,
      final: true
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:00.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.event.turn.text, "Dạ, em muốn, đặt ba chỗ.");
});

test("preserves readable time money and phone-like values in forwarded transcript text", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "user.transcription",
      text: "Lúc 19 : 00, cọc 300 . 000 đ, số 0912 345 678.",
      language: "vi-VN",
      turn_id: 4,
      stream_id: 42,
      user_id: "customer-1",
      words: null,
      final: true
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:04.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) {
    assert.equal(result.event.turn.text, "Lúc 19:00, cọc 300.000 đ, số 0912 345 678.");
  }
});

test("accepts a documented completed assistant transcription from Agora", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "assistant.transcription",
      text: "Bạn muốn khởi hành khi nào?",
      start_ms: 2400,
      duration_ms: 900,
      language: "vi-VN",
      turn_id: 1,
      stream_id: 0,
      user_id: "9001",
      words: null,
      quiet: false,
      turn_seq_id: 1,
      turn_status: 1
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:01.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.event.turn.speaker, "AGENT");
});

test("accepts an Agora text-mode assistant transcript without word metadata", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "assistant.transcription",
      text: "Mình đã ghi nhận, bạn muốn đi lúc mấy giờ?",
      start_ms: 3400,
      duration_ms: 1100,
      language: "vi-VN",
      turn_id: 2,
      stream_id: 0,
      user_id: "9001"
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:02.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) {
    assert.equal(result.event.turn.speaker, "AGENT");
    assert.equal(result.event.turn.text, "Mình đã ghi nhận, bạn muốn đi lúc mấy giờ?");
  }
});

test("accepts a text-mode assistant transcript with direct text and word metadata", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "assistant.transcription",
      text: "Please provide your departure date.",
      start_ms: 3400,
      duration_ms: 1100,
      language: "en-US",
      turn_id: 2,
      stream_id: 0,
      user_id: "9001",
      words: [{ text: "Please" }, { text: "provide" }]
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:02.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) {
    assert.equal(result.event.turn.speaker, "AGENT");
    assert.equal(result.event.turn.text, "Please provide your departure date.");
  }
});

test("accepts a text-mode assistant transcript whose provider names the text content differently", () => {
  const result = parseRtmTranscriptFrame(
    JSON.stringify({
      object: "assistant.transcription",
      content: "Mình đã ghi nhận yêu cầu của bạn.",
      turn_id: 3
    }),
    "9001",
    binding,
    new Date("2026-06-22T10:00:03.000Z")
  );

  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.event.turn.text, "Mình đã ghi nhận yêu cầu của bạn.");
});
