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

  test("live customer interim snapshots replace the same provider turn", () => {
    const first = reducer(makeInitialState(), {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-customer-1",
        speaker: "CUSTOMER",
        rawText: "Toi muon dat",
        final: false,
        timestamp: occurredAt
      }
    });
    const updated = reducer(first, {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-customer-1",
        speaker: "CUSTOMER",
        rawText: "Toi muon dat ve di Ha Noi",
        final: false,
        timestamp: occurredAt
      }
    });

    assert.equal(updated.transcript.length, 1);
    assert.deepEqual(updated.transcript[0], {
      sender: "customer",
      text: "Toi muon dat ve di Ha Noi",
      turnId: "agora-customer-1",
      providerTurnId: "agora-customer-1",
      authoritative: false,
      final: false,
      timestamp: occurredAt
    });
    assert.equal(updated.subtitles.speaker, "Khách hàng");
  });

  test("live AI final frames create a visible AI bubble immediately", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-agent-1",
        speaker: "AGENT",
        rawText: "Minh da ghi nhan, ban muon di ngay nao?",
        final: true,
        timestamp: occurredAt
      }
    });

    assert.deepEqual(state.transcript, [
      {
        sender: "ai",
        text: "Minh da ghi nhan, ban muon di ngay nao?",
        turnId: "agora-agent-1",
        providerTurnId: "agora-agent-1",
        authoritative: false,
        final: true,
        timestamp: occurredAt
      }
    ]);
    assert.equal(state.subtitles.speaker, "Tổng đài AI");
  });

  test("final SSE promotes the matching live bubble without duplication", () => {
    const live = reducer(makeInitialState(), {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-agent-1",
        speaker: "AGENT",
        rawText: "Minh da ghi nhan.",
        final: true,
        timestamp: occurredAt
      }
    });
    const authoritative = reducer(live, {
      type: ACTION.SERVER_EVENT,
      envelope: envelope(EventName.TranscriptTurnCreated, {
        turnId: "turn_public_agent1",
        sequenceNo: 2,
        speaker: "AGENT",
        content: "Minh da ghi nhan.",
        isFinal: true,
        timestamp: occurredAt
      })
    });

    assert.deepEqual(authoritative.transcript, [
      {
        sender: "ai",
        text: "Minh da ghi nhan.",
        turnId: "turn_public_agent1",
        timestamp: occurredAt
      }
    ]);
    assert.equal(authoritative.subtitles.text, "Minh da ghi nhan.");
  });

  test("late live interim frames cannot overwrite a finalized live turn", () => {
    const final = reducer(makeInitialState(), {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-agent-1",
        speaker: "AGENT",
        rawText: "Da ro.",
        final: true,
        sequence: 2
      }
    });
    const late = reducer(final, {
      type: ACTION.LIVE_TRANSCRIPT_FRAME,
      frame: {
        providerTurnId: "agora-agent-1",
        speaker: "AGENT",
        rawText: "Dang noi",
        final: false,
        sequence: 3
      }
    });

    assert.deepEqual(late.transcript, final.transcript);
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
