import assert from "node:assert/strict";
import { test } from "node:test";

import { EventName } from "@call-to-cash/shared";

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

test("applies a server event batch with the same projection semantics", () => {
  const transcriptEvent = envelope(EventName.TranscriptTurnCreated, {
    turnId: "turn_public1",
    sequenceNo: 1,
    speaker: "CUSTOMER",
    content: "I need four seats.",
    isFinal: true,
    timestamp: occurredAt
  });
  const analysisEvent = envelope(
    EventName.TranscriptAnalysisUpdated,
    {
      extractionId: "ext_public01",
      understood: { passengerCount: 4 },
      missingFields: ["departureAt"],
      contradictions: [],
      nextQuestion: "Please share the time."
    },
    2
  );
  const gateEvent = envelope(
    EventName.RiskPaymentGateUpdated,
    {
      previousDecision: "LOCKED",
      paymentGate: "READY_FOR_CONFIRMATION",
      nextAction: "ASK_CONFIRMATION",
      reasonCodes: [],
      agreementVersion: 1
    },
    4,
    { bookingId: "bk_public01" }
  );

  const envelopes = [transcriptEvent, analysisEvent, transcriptEvent, gateEvent];
  const sequential = envelopes.reduce(
    (state, nextEnvelope) => reducer(state, { type: ACTION.SERVER_EVENT, envelope: nextEnvelope }),
    makeInitialState()
  );
  const batched = reducer(makeInitialState(), { type: ACTION.SERVER_EVENTS, envelopes });

  assert.deepEqual(batched, sequential);
  assert.equal(batched.transcript.length, 1);
  assert.equal(batched.lastSequence, 4);
  assert.equal(batched.needsRecovery, true);
  assert.equal(batched.bookingId, "bk_public01");
});
