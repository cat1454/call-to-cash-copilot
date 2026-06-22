import assert from "node:assert/strict";
import test from "node:test";

import {
  canPersistFinalTranscriptForCall,
  shouldExtractBookingFacts
} from "./append-transcript-turn.js";
import { acceptProviderTranscriptEvent } from "./accept-provider-transcript-event.js";

test("only the trusted Agora post-session ingress can append a final turn after normal call end", () => {
  assert.equal(canPersistFinalTranscriptForCall("ACTIVE", false), true);
  assert.equal(canPersistFinalTranscriptForCall("ENDED", false), false);
  assert.equal(canPersistFinalTranscriptForCall("ENDED", true), true);
  assert.equal(canPersistFinalTranscriptForCall("FAILED", true), false);
  assert.equal(canPersistFinalTranscriptForCall("CANCELLED", true), false);
});

test("only customer turns can propose booking facts", () => {
  assert.equal(shouldExtractBookingFacts("CUSTOMER"), true);
  assert.equal(shouldExtractBookingFacts("AGENT"), false);
  assert.equal(shouldExtractBookingFacts("OPERATOR"), false);
  assert.equal(shouldExtractBookingFacts("SYSTEM"), false);
});

test("interim provider transcript frames do not reach durable transcript admission", async () => {
  const result = await acceptProviderTranscriptEvent({} as never, {
    callId: "call_public1",
    provider: "agora-conversation-ai",
    providerEventId: "evt_interim",
    providerTurnId: "turn_interim",
    speaker: "CUSTOMER",
    text: "Dạ, em muốn",
    isFinal: false,
    occurredAt: "2026-06-22T10:00:00.000Z",
    receivedAt: "2026-06-22T10:00:01.000Z",
    channelName: "ctc_call_public1",
    sessionId: "agent-session-1",
    requestId: "req_public1",
    sequenceNo: 1,
    language: "vi-VN"
  });

  assert.deepEqual(result, { accepted: false, persisted: false, duplicate: false });
});
