import assert from "node:assert/strict";
import test from "node:test";

import { TranscriptAnalysisUpdatedEventSchema } from "@call-to-cash/shared";

import {
  canPersistFinalTranscriptForCall,
  buildExtractionDiagnostics,
  buildTranscriptAnalysisProjection,
  deterministicCandidateFromFacts,
  isTrustedAgoraVoiceConfirmation,
  mergeValidatedCandidateFacts,
  nextAgreementVersion,
  retainCorroboratedCandidateFacts,
  resolveScheduleFromFacts,
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

test("voice confirmation uses the next agreement version after a booking change", () => {
  assert.equal(nextAgreementVersion([]), 1);
  assert.equal(nextAgreementVersion([{ version: 1 }]), 2);
  assert.equal(nextAgreementVersion([{ version: 4 }, { version: 3 }]), 5);
});

test("schedule resolver only assigns a departure for a single scheduled catalogue match", () => {
  const departures = [
    {
      publicId: "dep_demo_dad_nha_20260628_0700_own",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
      operationalStatus: "SCHEDULED",
      pickupPointCodes: ["DAD_TERMINAL"]
    },
    {
      publicId: "dep_demo_dad_nha_20260628_0730_own",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:30:00.000Z"),
      operationalStatus: "SCHEDULED",
      pickupPointCodes: ["DAD_CENTER"]
    },
    {
      publicId: "dep_demo_dad_nha_20260628_0745_cancelled",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:45:00.000Z"),
      operationalStatus: "CANCELLED",
      pickupPointCodes: ["DAD_TERMINAL"]
    }
  ];

  assert.deepEqual(
    resolveScheduleFromFacts(
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureServiceDate: "2026-06-28",
        departureLocalTime: "07:00",
        pickupPointCode: "DAD_TERMINAL"
      },
      departures
    ),
    {
      status: "MATCHED",
      departureId: "dep_demo_dad_nha_20260628_0700_own",
      reasons: []
    }
  );
  assert.deepEqual(
    resolveScheduleFromFacts(
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureServiceDate: "2026-06-28",
        departureLocalTime: "07:00",
        pickupPointCode: "DAD_CENTER"
      },
      departures
    ),
    { status: "NO_MATCH", reasons: ["PICKUP_NOT_SUPPORTED"] }
  );
  assert.deepEqual(
    resolveScheduleFromFacts(
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureServiceDate: "2026-06-28",
        departureLocalTime: "07:45"
      },
      departures
    ),
    { status: "NO_MATCH", reasons: ["DEPARTURE_CANCELLED"] }
  );
  assert.deepEqual(
    resolveScheduleFromFacts(
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureServiceDate: "2026-06-28",
        departureLocalTime: "08:00"
      },
      departures
    ),
    { status: "NO_MATCH", reasons: ["DEPARTURE_NOT_FOUND"] }
  );
});

test("schedule resolver asks for clarification when route, date, time, or exact departure is ambiguous", () => {
  const duplicateTime = [
    {
      publicId: "dep_demo_dad_nha_a",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
      operationalStatus: "SCHEDULED"
    },
    {
      publicId: "dep_demo_dad_nha_b",
      routeFrom: "Da Nang",
      routeTo: "Nha Trang",
      departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
      operationalStatus: "SCHEDULED"
    }
  ];

  assert.deepEqual(resolveScheduleFromFacts({}, duplicateTime), {
    status: "NEEDS_CLARIFICATION",
    reasons: ["MISSING_ROUTE"]
  });
  assert.deepEqual(
    resolveScheduleFromFacts({ routeFrom: "Da Nang", routeTo: "Nha Trang" }, duplicateTime),
    {
      status: "NEEDS_CLARIFICATION",
      reasons: ["MISSING_DATE"]
    }
  );
  assert.deepEqual(
    resolveScheduleFromFacts(
      { routeFrom: "Da Nang", routeTo: "Nha Trang", departureServiceDate: "2026-06-28" },
      duplicateTime
    ),
    { status: "NEEDS_CLARIFICATION", reasons: ["MISSING_TIME"] }
  );
  assert.deepEqual(
    resolveScheduleFromFacts(
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureServiceDate: "2026-06-28",
        departureLocalTime: "07:00"
      },
      duplicateTime
    ),
    { status: "NEEDS_CLARIFICATION", reasons: ["AMBIGUOUS_TIME"] }
  );
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

test("high-confidence LLM extraction can fill a supported passenger count and pickup proposal", () => {
  const result = mergeValidatedCandidateFacts(
    {},
    {
      schemaVersion: "ctc.booking-extraction.v1",
      fields: {
        passengerCount: {
          value: 1,
          confidence: 0.96,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        },
        pickupPoint: {
          value: "Bến xe trung tâm Đà Nẵng",
          confidence: 0.97,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        }
      },
      warnings: []
    },
    "turn_phase10source",
    [
      {
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
      }
    ],
    "mot hanh khach, don o ben xe trung tam Da Nang"
  );

  assert.deepEqual(result, { passengerCount: 1, pickupPoint: "Ben xe trung tam Da Nang" });
});

test("LLM extraction cannot infer a default passenger count from correction filler", () => {
  const result = mergeValidatedCandidateFacts(
    {},
    {
      schemaVersion: "ctc.booking-extraction.v1",
      fields: {
        passengerCount: {
          value: 1,
          confidence: 0.96,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        }
      },
      warnings: []
    },
    "turn_phase10source",
    [],
    "Đổi xíu, đổi xíu."
  );

  assert.deepEqual(result, {});
});

test("high-confidence LLM pickup proposals must validate against catalogue-derived pickup points", () => {
  const result = mergeValidatedCandidateFacts(
    {},
    {
      schemaVersion: "ctc.booking-extraction.v1",
      fields: {
        pickupPoint: {
          value: "Ben xe Can Tho",
          confidence: 0.97,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase105source" }]
        }
      },
      warnings: []
    },
    "turn_phase105source",
    [
      {
        routeFrom: "Can Tho",
        routeTo: "Da Lat",
        departureAtUtc: new Date("2027-05-25T00:30:00.000Z")
      }
    ]
  );

  assert.deepEqual(result, { pickupPoint: "Ben xe Can Tho" });
});

test("high-confidence LLM route values must normalize to one scheduled catalogue route", () => {
  const result = mergeValidatedCandidateFacts(
    {},
    {
      schemaVersion: "ctc.booking-extraction.v1",
      fields: {
        origin: {
          value: "Đà Nẵng",
          confidence: 0.95,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        },
        destination: {
          value: "Hà Nội",
          confidence: 0.95,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        },
        departureDate: {
          value: "2026-07-20",
          confidence: 0.97,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        },
        departureTime: {
          value: "19:00",
          confidence: 0.97,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        }
      },
      warnings: []
    },
    "turn_phase10source",
    [
      {
        routeFrom: "Da Nang",
        routeTo: "Ha Noi",
        departureAtUtc: new Date("2026-07-20T12:00:00.000Z")
      }
    ]
  );

  assert.deepEqual(result, {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi",
    departureLocalTime: "19:00",
    departureDay: 20,
    departureMonth: 7
  });
});

test("LLM extraction cannot introduce low-confidence or unsupported booking fields", () => {
  const result = mergeValidatedCandidateFacts(
    {},
    {
      schemaVersion: "ctc.booking-extraction.v1",
      fields: {
        passengerCount: {
          value: 4,
          confidence: 0.6,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        },
        pickupPoint: {
          value: "Điểm đón mặc định",
          confidence: 0.99,
          status: "PRESENT",
          evidenceRefs: [{ turnId: "turn_phase10source" }]
        }
      },
      warnings: []
    },
    "turn_phase10source",
    []
  );

  assert.deepEqual(result, {});
});

test("extraction diagnostics persist missing and ambiguous candidate fields", () => {
  const diagnostics = buildExtractionDiagnostics({
    schemaVersion: "ctc.booking-extraction.v1",
    fields: {
      origin: {
        value: null,
        confidence: 0.4,
        status: "MISSING",
        evidenceRefs: [{ turnId: "turn_phase10source" }]
      },
      departureTime: {
        value: null,
        confidence: 0.55,
        status: "AMBIGUOUS",
        evidenceRefs: [{ turnId: "turn_phase10source" }]
      },
      contactPhoneCandidate: {
        value: "0901***567",
        confidence: 0.98,
        status: "PRESENT",
        evidenceRefs: [{ turnId: "turn_phase10source" }]
      }
    },
    warnings: []
  });

  assert.deepEqual(diagnostics.missingFields, ["routeFrom", "departureAt"]);
  assert.deepEqual(diagnostics.contradictions, [
    {
      field: "departureAt",
      evidenceSegmentIds: ["turn_phase10source"],
      reason: "AMBIGUOUS"
    }
  ]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /0901567/u);
});

test("transcript analysis projection is schema-valid and privacy-safe", () => {
  const projection = buildTranscriptAnalysisProjection(
    "ext_public01",
    {
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureAtUtc: new Date("2026-07-20T12:00:00.000Z"),
      passengerCount: 4,
      pickupPointDisplay: "Ben xe Trung tam Da Nang",
      contactPhoneMasked: "0901***567"
    },
    ["refundPolicyConfirmation"],
    []
  );
  const event = {
    eventId: "evt_public01",
    event: "transcript.analysis.updated",
    version: 1,
    occurredAt: "2026-06-22T10:00:00.000Z",
    callId: "call_public1",
    bookingId: "bk_public01",
    sequence: 1,
    data: projection
  };

  assert.equal(TranscriptAnalysisUpdatedEventSchema.safeParse(event).success, true);
  assert.deepEqual(projection.understood, {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi",
    departureAt: "2026-07-20T12:00:00.000Z",
    passengerCount: 4,
    pickupPoint: "Ben xe Trung tam Da Nang",
    contactPhoneMasked: "0901***567"
  });
  assert.equal(
    projection.nextQuestion,
    "Em đã có đủ thông tin đặt chỗ, vui lòng xác nhận điều khoản cọc."
  );
  assert.doesNotMatch(JSON.stringify(projection), /0901567|raw transcript|canonicalPayload/u);
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
