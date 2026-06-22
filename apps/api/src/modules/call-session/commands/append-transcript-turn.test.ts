import assert from "node:assert/strict";
import test from "node:test";

import {
  canPersistFinalTranscriptForCall,
  shouldExtractBookingFacts
} from "./append-transcript-turn.js";

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
