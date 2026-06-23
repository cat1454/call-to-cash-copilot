import assert from "node:assert/strict";
import test from "node:test";

import {
  canPersistFinalTranscriptForCall,
  deterministicCandidateFromFacts,
  isTrustedAgoraVoiceConfirmation,
  retainCorroboratedCandidateFacts,
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
  assert.equal(isTrustedAgoraVoiceConfirmation("AGORA", "Tôi xác nhận đặt cọc."), true);
  assert.equal(isTrustedAgoraVoiceConfirmation("REPLAY", "Tôi xác nhận đặt cọc."), false);
});

test("deterministic Phase 10 candidates carry source-turn evidence and masked contact only", () => {
  const candidate = deterministicCandidateFromFacts(
    {
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureLocalTime: "20:00",
      passengerCount: 3,
      contactPhoneMasked: "0901***567"
    },
    "turn_phase10source"
  );

  assert.equal(candidate.fields.origin?.evidenceRefs[0]?.turnId, "turn_phase10source");
  assert.equal(candidate.fields.contactPhoneCandidate?.value, "0901***567");
  assert.equal(JSON.stringify(candidate).includes("0901234567"), false);
});

test("LLM candidates cannot introduce booking facts without deterministic corroboration", () => {
  const facts = { routeFrom: "Da Nang" };
  const candidate = deterministicCandidateFromFacts({ routeFrom: "Ha Noi" }, "turn_phase10source");
  const result = retainCorroboratedCandidateFacts(facts, candidate, "turn_phase10source");

  assert.deepEqual(result, facts);
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
