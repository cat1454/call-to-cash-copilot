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

const catalogueDepartures = [
  {
    routeCode: "CTO-DLI",
    routeFrom: "Can Tho",
    routeTo: "Da Lat",
    departureAtUtc: new Date("2027-05-25T00:30:00.000Z")
  },
  {
    routeCode: "HUE-NHA",
    routeFrom: "Hue",
    routeTo: "Nha Trang",
    departureAtUtc: new Date("2027-05-26T02:00:00.000Z")
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

test("extracts the Da Nang to Ha Noi happy-path facts and its supported pickup point", () => {
  const facts = extractReplayFacts(
    "Tôi muốn đi Đà Nẵng Hà Nội ngày 28 tháng 6 lúc 19 giờ, 3 người, đón ở bến xe trung tâm Đà Nẵng.",
    {
      departures: [
        {
          routeFrom: "Da Nang",
          routeTo: "Ha Noi",
          departureAtUtc: new Date("2026-06-28T12:00:00.000Z")
        }
      ],
      now: new Date("2026-06-22T00:00:00.000Z")
    }
  );

  assert.deepEqual(facts, {
    routeFrom: "Da Nang",
    routeTo: "Ha Noi",
    departureLocalTime: "19:00",
    departureDay: 28,
    departureMonth: 6,
    passengerCount: 3,
    pickupPoint: "Ben xe Trung tam Da Nang"
  });
});

test("extracts an arbitrary catalogue route, schedule, seats, contact, and route-derived pickup", () => {
  const facts = extractReplayFacts(
    "Em dat 2 ve tu Can Tho den Da Lat ngay 25/5 luc 07:30, don o ben xe Can Tho, lien he 0912345678.",
    {
      departures: catalogueDepartures,
      now: new Date("2027-05-01T00:00:00.000Z")
    }
  );

  assert.deepEqual(facts, {
    routeFrom: "Can Tho",
    routeTo: "Da Lat",
    departureLocalTime: "07:30",
    departureDay: 25,
    departureMonth: 5,
    passengerCount: 2,
    pickupPoint: "Ben xe Can Tho",
    contactPhoneMasked: "0912***678"
  });
});

test("extracts destination-before-origin phrasing only when the catalogue route is valid", () => {
  const facts = extractReplayFacts(
    "Toi muon di Da Lat tu Can Tho ngay 25/5 luc 07:30 cho 3 nguoi.",
    {
      departures: catalogueDepartures,
      now: new Date("2027-05-01T00:00:00.000Z")
    }
  );

  assert.equal(facts.routeFrom, "Can Tho");
  assert.equal(facts.routeTo, "Da Lat");
  assert.equal(facts.passengerCount, 3);
});

test("extracts route-coded pickup aliases from the catalogue metadata", () => {
  const facts = extractReplayFacts(
    "Toi muon di Hue den Nha Trang ngay 20/6 luc 07:00 cho 3 nguoi, don o ben xe phia nam Hue.",
    {
      departures: catalogueDepartures,
      now: new Date("2027-05-01T00:00:00.000Z")
    }
  );

  assert.equal(facts.routeFrom, "Hue");
  assert.equal(facts.routeTo, "Nha Trang");
  assert.equal(facts.pickupPoint, "Ben xe phia Nam Hue");
});

test("prefers the replacement passenger count after Vietnamese change keywords", () => {
  for (const content of [
    "Tôi muốn sửa số lượng hành khách từ ba người thành bốn người.",
    "Đổi sang bốn người nhé.",
    "Cho tôi đổi qua bốn khách."
  ]) {
    assert.equal(extractReplayFacts(content).passengerCount, 4, content);
  }
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

test("normalizes transcript display text without inventing capitalization or terminal punctuation", () => {
  assert.equal(
    formatTranscriptForDisplay("  tôi   muốn đi đà nẵng hà nội  "),
    "tôi muốn đi đà nẵng hà nội"
  );
});

test("normalizes transcript whitespace and punctuation boundaries for display", () => {
  assert.equal(
    formatTranscriptForDisplay("  dạ ,   em muốn đặt   3 chỗ .  "),
    "dạ, em muốn đặt 3 chỗ."
  );
});
