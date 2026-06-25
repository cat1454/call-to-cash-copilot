import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { loadTripScheduleRows, nextVietnamScheduleDate } from "./schedule-fixture.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "trip-schedule-demo.csv"
);

test("loads an Excel-editable trip schedule fixture without inventing schedule facts", () => {
  const rows = loadTripScheduleRows(fixturePath, new Date("2026-06-25T00:00:00.000Z"));

  assert.equal(rows.length, 36);
  assert.deepEqual(rows[0], {
    publicId: "dep_demo_cantho_dalat_0525_0730",
    routeCode: "CTO-DLI-DEMO-0730",
    routeFrom: "Can Tho",
    routeTo: "Da Lat",
    departureAtUtc: new Date("2027-05-25T00:30:00.000Z"),
    departureTimezone: "Asia/Ho_Chi_Minh",
    capacity: 36,
    operationalStatus: "SCHEDULED",
    currency: "VND",
    farePerSeatMinor: 420000,
    depositAmountMinor: 300000,
    pricePolicyVersion: "BUS-PRICE-V1",
    refundPolicyVersion: "BUS-V1/1.0",
    pickupPoints: ["Ben xe Can Tho", "Ben xe trung tam Can Tho"]
  });
});

test("covers every day from 25 to 30 May with multiple departures per route", () => {
  const rows = loadTripScheduleRows(fixturePath, new Date("2026-06-25T00:00:00.000Z"));
  const days = new Set(
    rows.map((row) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        month: "2-digit",
        day: "2-digit"
      }).format(row.departureAtUtc)
    )
  );
  const hueMorningSlots = rows
    .filter((row) => row.routeFrom === "Hue" && row.routeTo === "Nha Trang")
    .map((row) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).format(row.departureAtUtc)
    );

  assert.deepEqual([...days].sort(), ["05-25", "05-26", "05-27", "05-28", "05-29", "05-30"]);
  assert.equal(hueMorningSlots.includes("07:00"), true);
  assert.equal(hueMorningSlots.includes("07:30"), true);
  assert.equal(hueMorningSlots.includes("08:00"), true);
});

test("rolls a May demo schedule to the next future year when the current date is past May", () => {
  assert.equal(
    nextVietnamScheduleDate(5, 25, "07:30", new Date("2026-06-25T00:00:00.000Z")).toISOString(),
    "2027-05-25T00:30:00.000Z"
  );
});
