import assert from "node:assert/strict";
import test from "node:test";

import { AssistantTurnBuffer, deliveryModeForRtmFrame } from "./rtm-delivery.js";
import { RelayTranscriptStats } from "./relay-transcript-stats.js";
import type { RtmTranscriptFrame } from "./rtm-transcript-frame.js";

const agentTurn = (text: string): RtmTranscriptFrame => ({
  type: "ctc.transcript.final/v1",
  eventId: "agora-agent-turn-1",
  callId: "call_123456",
  channelName: "call_123456",
  sessionId: "agent-session-1",
  occurredAt: "2026-06-22T10:00:00.000Z",
  turn: {
    id: "agora-agent-turn-1",
    sequenceNo: 2,
    speaker: "AGENT",
    text,
    language: "vi-VN",
    final: true
  }
});

test("debounces text-mode assistant updates and forwards only the latest turn once", async () => {
  let scheduled: (() => void) | undefined;
  const forwarded: RtmTranscriptFrame[] = [];
  const buffer = new AssistantTurnBuffer(
    async (event) => {
      forwarded.push(event);
    },
    500,
    (callback) => {
      scheduled = callback;
      return 1;
    },
    () => undefined
  );

  buffer.push(agentTurn("Mình đã ghi"), "debounced");
  buffer.push(agentTurn("Mình đã ghi nhận."), "debounced");
  assert.equal(forwarded.length, 0);

  scheduled?.();
  await Promise.resolve();
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]?.turn.text, "Mình đã ghi nhận.");

  buffer.push(agentTurn("Mình đã ghi nhận."), "immediate");
  assert.equal(forwarded.length, 1);
});

test("classifies terminal assistant frames for immediate delivery", () => {
  assert.equal(
    deliveryModeForRtmFrame(
      JSON.stringify({ object: "assistant.transcription", text: "Đã rõ.", turn_status: 1 })
    ),
    "immediate"
  );
  assert.equal(
    deliveryModeForRtmFrame(
      JSON.stringify({ object: "assistant.transcription", text: "Đang nói" })
    ),
    "debounced"
  );
});

test("relay statistics expose counts without transcript content", () => {
  const stats = new RelayTranscriptStats();
  stats.recordReceived(
    JSON.stringify({ object: "assistant.transcription", text: "Nội dung nhạy cảm" })
  );
  stats.recordReceived(JSON.stringify({ object: "assistant.transcription" }));
  stats.recordAccepted("AGENT");
  stats.recordRejected("PARTIAL");

  const snapshot = stats.snapshot(1);
  assert.deepEqual(snapshot.received, { customer: 0, agent: 2, unknown: 0 });
  assert.deepEqual(snapshot.accepted, { customer: 0, agent: 1 });
  assert.deepEqual(snapshot.rejected, { PARTIAL: 1 });
  assert.deepEqual(snapshot.assistantText, { direct: 1, alternate: 0, missing: 1, nonString: 0 });
  assert.doesNotMatch(JSON.stringify(snapshot), /Nội dung nhạy cảm/u);
});
