import assert from "node:assert/strict";
import test from "node:test";

import { formatTranscriptForDisplay } from "../call-session.presenter.js";
import { extractReplayFacts } from "./replay-extractor.js";

const departures = [
  {
    routeFrom: "Da Nang",
    routeTo: "Nha Trang",
    departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
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
    routeCode: "DAD-NHA",
    routeFrom: "Da Nang",
    routeTo: "Nha Trang",
    departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
  }
];

test("extracts a catalogue-backed route in the spoken direction", () => {
  const facts = extractReplayFacts("Toi muon dat chuyen di Da Nang Nha Trang", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, "Da Nang");
  assert.equal(facts.routeTo, "Nha Trang");
});

test("extracts the Da Nang to Nha Trang route when ASR inserts a dash", () => {
  const facts = extractReplayFacts("Toi muon dat ve di Đà Nẵng - Nha Trang", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, "Da Nang");
  assert.equal(facts.routeTo, "Nha Trang");
});

test("extracts Vietnamese word-based date and time without treating the date as passengers", () => {
  const facts = extractReplayFacts("muoi chin gio ngay hai muoi thang bay", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.departureLocalTime, "19:00");
  assert.equal(facts.departureDay, 20);
  assert.equal(facts.departureMonth, 7);
  assert.equal(facts.passengerCount, undefined);
});

test("extracts the Da Nang to Nha Trang happy-path facts and its supported pickup point", () => {
  const facts = extractReplayFacts(
    "Toi muon di Da Nang Nha Trang ngay 28 thang 6 luc 7 gio, 3 nguoi, don o ben xe trung tam Da Nang.",
    {
      departures: [
        {
          routeCode: "DAD-NHA",
          routeFrom: "Da Nang",
          routeTo: "Nha Trang",
          departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
        }
      ],
      now: new Date("2026-06-22T00:00:00.000Z")
    }
  );

  assert.deepEqual(facts, {
    routeFrom: "Da Nang",
    routeTo: "Nha Trang",
    departureLocalTime: "07:00",
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
    "Toi muon di Da Nang den Nha Trang ngay 28/6 luc 07:00 cho 3 nguoi, don o ben xe trung tam Da Nang.",
    {
      departures: catalogueDepartures,
      now: new Date("2026-06-22T00:00:00.000Z")
    }
  );

  assert.equal(facts.routeFrom, "Da Nang");
  assert.equal(facts.routeTo, "Nha Trang");
  assert.equal(facts.pickupPoint, "Ben xe Trung tam Da Nang");
});

test("returns canonical DB pickup name when a database-backed alias matches", () => {
  const facts = extractReplayFacts(
    "Toi muon di Da Nang den Nha Trang ngay 28/6 luc 07:00 cho 3 nguoi, don o hai chau.",
    {
      departures: [
        {
          routeCode: "DAD-NHA",
          routeFrom: "Da Nang",
          routeTo: "Nha Trang",
          departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
          pickupPoints: [
            {
              canonicalName: "Trung tam Da Nang",
              aliases: ["hai chau"]
            }
          ]
        }
      ],
      now: new Date("2026-06-22T00:00:00.000Z")
    }
  );

  assert.equal(facts.pickupPoint, "Trung tam Da Nang");
});

test("does not match a stale departure that was filtered out of runtime catalogue input", () => {
  const facts = extractReplayFacts("Toi muon di Can Tho den Da Lat ngay 25/5 luc 07:30", {
    departures: [
      {
        routeCode: "DAD-NHA",
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
      }
    ],
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, undefined);
  assert.equal(facts.routeTo, undefined);
});

test("prefers the replacement passenger count after Vietnamese change keywords", () => {
  for (const content of [
    "Toi muon sua so luong hanh khach tu ba nguoi thanh bon nguoi.",
    "Doi sang bon nguoi nhe.",
    "Cho toi doi qua bon khach."
  ]) {
    assert.equal(extractReplayFacts(content).passengerCount, 4, content);
  }
});

test("keeps numeric 22:30 replay input compatible with the departure catalogue", () => {
  const facts = extractReplayFacts("chuyen 22:30", { departures });
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
  const facts = extractReplayFacts("So dien thoai khong chin mot hai ba bon nam sau bay tam");
  assert.equal(facts.contactPhoneMasked, "0912***678");
});

test("does not invent a route that is absent from the scheduled catalogue", () => {
  const facts = extractReplayFacts("Toi muon di Da Nang den Can Tho", {
    departures,
    now: new Date("2026-06-22T00:00:00.000Z")
  });

  assert.equal(facts.routeFrom, undefined);
  assert.equal(facts.routeTo, undefined);
});

test("normalizes transcript display text without inventing capitalization or terminal punctuation", () => {
  assert.equal(
    formatTranscriptForDisplay("  toi   muon di da nang nha trang  "),
    "toi muon di da nang nha trang"
  );
});

test("normalizes transcript whitespace and punctuation boundaries for display", () => {
  assert.equal(
    formatTranscriptForDisplay("  da ,   em muon dat   3 cho .  "),
    "da, em muon dat 3 cho."
  );
});
