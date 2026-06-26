import assert from "node:assert/strict";
import test from "node:test";

import { BookingExtractionCandidateSchema } from "./index.js";

const sourceTurnId = "turn_phase10source";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "ctc.booking-extraction.v1",
    fields: {
      origin: {
        value: "Da Nang",
        confidence: 0.92,
        status: "PRESENT",
        evidenceRefs: [{ turnId: sourceTurnId, start: 0, end: 7 }]
      }
    },
    warnings: [],
    ...overrides
  };
}

test("Phase 10 candidate accepts approved booking facts with bounded confidence", () => {
  assert.equal(BookingExtractionCandidateSchema.safeParse(candidate()).success, true);
});

test("Phase 10 candidate rejects unknown and authority fields", () => {
  assert.equal(
    BookingExtractionCandidateSchema.safeParse(
      candidate({ fields: { ...candidate().fields, paymentGate: "OPEN" } })
    ).success,
    false
  );
  assert.equal(
    BookingExtractionCandidateSchema.safeParse({ ...candidate(), price: 100_000 }).success,
    false
  );
});

test("Phase 10 candidate rejects invalid confidence, empty evidence, and raw reasoning", () => {
  assert.equal(
    BookingExtractionCandidateSchema.safeParse(
      candidate({
        fields: {
          origin: {
            value: "Da Nang",
            confidence: 1.1,
            status: "PRESENT",
            evidenceRefs: [{ turnId: sourceTurnId }]
          }
        }
      })
    ).success,
    false
  );
  assert.equal(
    BookingExtractionCandidateSchema.safeParse(
      candidate({
        fields: {
          origin: { value: "Da Nang", confidence: 0.9, status: "PRESENT", evidenceRefs: [] }
        }
      })
    ).success,
    false
  );
  assert.equal(
    BookingExtractionCandidateSchema.safeParse({ ...candidate(), reasoning: "hidden" }).success,
    false
  );
  assert.equal(
    BookingExtractionCandidateSchema.safeParse(
      candidate({
        fields: {
          origin: {
            value: "Da Nang",
            confidence: 0.9,
            status: "PRESENT",
            evidenceRefs: [{ turnId: "not-a-public-turn-id" }]
          }
        }
      })
    ).success,
    false
  );
});
