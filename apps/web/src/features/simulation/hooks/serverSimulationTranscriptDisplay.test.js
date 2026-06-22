import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EventName, normalizeTranscriptDisplayText } from "@call-to-cash/shared";

import { ACTION, makeInitialState, reducer } from "./serverSimulationState.js";

const occurredAt = "2026-06-21T10:00:00.000Z";

function envelope(event, data, sequence = 1, overrides = {}) {
  return {
    eventId: `evt_public${sequence}`,
    event,
    version: 1,
    occurredAt,
    callId: "call_public1",
    bookingId: null,
    sequence,
    data,
    ...overrides
  };
}

describe("server simulation transcript display projection", () => {
  test("masks raw PII before deterministic display normalization", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.SERVER_EVENT,
      envelope: envelope(EventName.TranscriptTurnCreated, {
        turnId: "turn_public1",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        content: "Call 0912 345 678 or person@example.com",
        isFinal: true,
        timestamp: occurredAt
      })
    });

    assert.deepEqual(state.transcript, [
      {
        sender: "customer",
        text: "Call [PHONE] or [EMAIL]",
        turnId: "turn_public1",
        timestamp: occurredAt
      }
    ]);
    assert.equal(JSON.stringify(state).includes("0912 345 678"), false);
    assert.equal(JSON.stringify(state).includes("person@example.com"), false);
  });

  test("normalizer does not split sensitive-looking display formats", () => {
    assert.equal(normalizeTranscriptDisplayText("person@example.com"), "person@example.com");
    assert.equal(normalizeTranscriptDisplayText("19 : 00"), "19:00");
    assert.equal(normalizeTranscriptDisplayText("300 . 000 đ"), "300.000 đ");
    assert.equal(
      normalizeTranscriptDisplayText("https://example.com/path"),
      "https://example.com/path"
    );
  });

  test("normalizes transcript text from SSE without semantic rewriting", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.SERVER_EVENT,
      envelope: envelope(EventName.TranscriptTurnCreated, {
        turnId: "turn_public_spacing",
        sequenceNo: 1,
        speaker: "CUSTOMER",
        content: "Dạ,   em muốn , đặt ba chỗ .",
        isFinal: true,
        timestamp: occurredAt
      })
    });

    assert.equal(state.transcript.length, 1);
    assert.equal(state.transcript[0]?.text, "Dạ, em muốn, đặt ba chỗ.");
    assert.equal(state.subtitles.text, "Dạ, em muốn, đặt ba chỗ.");
  });

  test("REST transcript recovery uses the same masking and display normalization", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.TRANSCRIPT_SYNCED,
      transcript: {
        callId: "call_public1",
        turns: [
          {
            turnId: "turn_public1",
            sequenceNo: 1,
            speaker: "CUSTOMER",
            content: "Call 0912 345 678 or person@example.com lúc 19 : 00, cọc 300 . 000 đ.",
            isFinal: true,
            createdAt: occurredAt
          }
        ]
      }
    });

    assert.deepEqual(state.transcript, [
      {
        sender: "customer",
        text: "Call [PHONE] or [EMAIL] lúc 19:00, cọc 300.000 đ.",
        turnId: "turn_public1",
        timestamp: occurredAt
      }
    ]);
  });
});
