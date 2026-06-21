import assert from "node:assert/strict";
import test from "node:test";

import { TranscriptDeduplicator, normalizeTranscriptEvent } from "./index.js";

test("normalizes final provider transcript turns and keeps provider turn identity", () => {
  assert.deepEqual(
    normalizeTranscriptEvent({
      type: "transcript.turn",
      eventId: "evt_1",
      turn: {
        id: "provider-turn-1",
        sequenceNo: 2,
        speaker: "CUSTOMER",
        text: "  Xin chào  ",
        language: "vi-VN",
        final: true,
        confidence: 0.91
      }
    }),
    {
      providerTurnId: "provider-turn-1",
      sequenceNo: 2,
      speaker: "CUSTOMER",
      content: "Xin chào",
      language: "vi-VN",
      isFinal: true,
      sttConfidence: 0.91
    }
  );
});

test("deduplicator only accepts a provider turn once", () => {
  const deduplicator = new TranscriptDeduplicator();
  assert.equal(deduplicator.accept("provider-turn-1"), true);
  assert.equal(deduplicator.accept("provider-turn-1"), false);
});
