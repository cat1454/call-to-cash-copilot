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

test("does not project transcript analysis into the phone booking summary", () => {
  const analysis = {
    extractionId: "ext_public01",
    understood: {
      routeFrom: "Đà Nẵng",
      routeTo: "Nha Trang",
      departureAt: "2026-06-28T00:00:00.000Z",
      passengerCount: 3,
      contactPhoneMasked: "0905***233",
      contactPhone: "0905112233"
    },
    missingFields: ["pickupPoint"],
    contradictions: [],
    nextQuestion: "Anh/chị đón ở điểm nào?"
  };

  const state = reducer(makeInitialState(), {
    type: ACTION.SERVER_EVENT,
    envelope: envelope(EventName.TranscriptAnalysisUpdated, analysis, 2, {
      bookingId: "bk_public01"
    })
  });

  assert.equal(state.bookingId, "bk_public01");
  assert.deepEqual(state.bookingData, {
    bookingId: "",
    route: "",
    date: "",
    time: "",
    seats: "",
    phone: "",
    price: "",
    deposit: ""
  });
  assert.match(state.transcriptAnalysis.understood, /Đà Nẵng.*Nha Trang.*3.*0905\*\*\*233/u);
  assert.equal(state.bookingData.price, "");
  assert.equal(state.bookingData.deposit, "");
  assert.doesNotMatch(JSON.stringify(state.bookingData), /0905112233/u);
});
