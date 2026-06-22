import assert from "node:assert/strict";
import test from "node:test";

import { formatTranscriptForDisplay } from "../call-session.presenter.js";
import { extractReplayFacts } from "./replay-extractor.js";

const departures = [
  {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi",
    departureAtUtc: new Date("2026-07-20T12:00:00.000Z")
  },
  {
    routeFrom: "Ha Noi",
    routeTo: "Sa Pa",
    departureAtUtc: new Date("2026-07-21T15:30:00.000Z")
  }
];

test("extracts a catalogue-backed route in the spoken direction", () => {
  const facts = extractReplayFacts("Tôi muốn đặt chuyến đi Đà Nẵng Hà Nội", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, "Da Nang");
  assert.equal(facts.routeTo, "Ha Noi");
});

test("extracts Vietnamese word-based date and time without treating the date as passengers", () => {
  const facts = extractReplayFacts("mười chín giờ ngày hai mươi tháng bảy", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.departureLocalTime, "19:00");
  assert.equal(facts.departureDay, 20);
  assert.equal(facts.departureMonth, 7);
  assert.equal(facts.passengerCount, undefined);
});

test("keeps numeric 22:30 replay input compatible with the departure catalogue", () => {
  const facts = extractReplayFacts("chuyến 22:30", { departures });
  assert.equal(facts.departureLocalTime, "22:30");
});

test("accepts a spoken hour:minute with joined route words from live Vietnamese ASR", () => {
  const facts = extractReplayFacts("Ha Noi Sapa, hai muoi hai:ba muoi phut.", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, "Ha Noi");
  assert.equal(facts.routeTo, "Sa Pa");
  assert.equal(facts.departureLocalTime, "22:30");
});

test("extracts a valid phone number spoken digit by digit and masks it", () => {
  const facts = extractReplayFacts("Số điện thoại không chín một hai ba bốn năm sáu bảy tám");
  assert.equal(facts.contactPhoneMasked, "0912***678");
});

test("does not invent a route that is absent from the scheduled catalogue", () => {
  const facts = extractReplayFacts("Tôi muốn đi Huế đến Cần Thơ", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, undefined);
  assert.equal(facts.routeTo, undefined);
});

test("formats display text without semantically rewriting it", () => {
  assert.equal(
    formatTranscriptForDisplay("  tôi   muốn đi đà nẵng hà nội  "),
    "Tôi muốn đi đà nẵng hà nội."
  );
});
