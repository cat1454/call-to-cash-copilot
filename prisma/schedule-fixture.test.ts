import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  loadPickupPointRows,
  loadRevenueTwinDemandRows,
  loadRevenueTwinPolicyRows,
  loadTripInventoryRows,
  loadTripScheduleRows,
  tripScheduleRowToDepartureSeed
} from "./schedule-fixture.js";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const schedulePath = path.join(fixtureDir, "trip-schedule-demo.csv");
const pickupPath = path.join(fixtureDir, "pickup-point-demo.csv");
const inventoryPath = path.join(fixtureDir, "trip-inventory-demo.csv");
const demandPath = path.join(fixtureDir, "revenue-twin-demand-demo.csv");
const policyPath = path.join(fixtureDir, "revenue-twin-policy-demo.csv");
const scheduleHeader =
  "publicId,routeCode,serviceCode,operatorCode,operatorRelation,routeFromCode,routeFrom,routeToCode,routeTo,serviceDate,localTime,timezone,pickupPointCodes,capacity,farePerSeatMinor,depositRuleCode,pricePolicyVersion,refundPolicyVersion,incentivePolicyVersion,status";

function writeTempFixture(content: string): string {
  const filePath = path.join(os.tmpdir(), `ctc-fixture-${Date.now()}-${Math.random()}.csv`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function validScheduleFixture(overrides: Partial<Record<string, string>> = {}): string {
  const values: Record<string, string> = {
    publicId: "dep_x",
    routeCode: "HUE-NHA",
    serviceCode: "HUE-NHA-0700",
    operatorCode: "ctc_demo_own",
    operatorRelation: "OWN_FLEET",
    routeFromCode: "HUE",
    routeFrom: "Hue",
    routeToCode: "NHA",
    routeTo: "Nha Trang",
    serviceDate: "2030-06-20",
    localTime: "07:00",
    timezone: "Asia/Ho_Chi_Minh",
    pickupPointCodes: "HUE_TERMINAL",
    capacity: "20",
    farePerSeatMinor: "420000",
    depositRuleCode: "DEPOSIT_50K",
    pricePolicyVersion: "BUS-PRICE-V1",
    refundPolicyVersion: "BUS-V1/1.0",
    incentivePolicyVersion: "SRRRO-V1",
    status: "SCHEDULED",
    ...overrides
  };
  return [
    scheduleHeader,
    scheduleHeader
      .split(",")
      .map((header) => values[header])
      .join(",")
  ].join("\n");
}

test("loads strict Excel-editable schedule, pickup, inventory, demand, and policy fixtures", () => {
  const pickupRows = loadPickupPointRows(pickupPath);
  const policyRows = loadRevenueTwinPolicyRows(policyPath);
  const rows = loadTripScheduleRows(schedulePath, {
    pickupRows,
    policyRows
  });
  const inventoryRows = loadTripInventoryRows(inventoryPath, rows);
  const demandRows = loadRevenueTwinDemandRows(demandPath, pickupRows);

  assert.equal(rows.filter((row) => row.status === "SCHEDULED").length >= 96, true);
  assert.deepEqual(rows[0], {
    publicId: "dep_demo_hue_nha_20300620_0700_own",
    routeCode: "HUE-NHA",
    serviceCode: "HUE-NHA-0700",
    operatorCode: "ctc_demo_own",
    operatorRelation: "OWN_FLEET",
    routeFromCode: "HUE",
    routeFrom: "Hue",
    routeToCode: "NHA",
    routeTo: "Nha Trang",
    serviceDate: "2030-06-20",
    localTime: "07:00",
    timezone: "Asia/Ho_Chi_Minh",
    pickupPointCodes: ["HUE_TERMINAL", "HUE_CENTER"],
    capacity: 20,
    farePerSeatMinor: 420000,
    depositRuleCode: "DEPOSIT_50K",
    depositAmountMinor: 50000,
    pricePolicyVersion: "BUS-PRICE-V1",
    refundPolicyVersion: "BUS-V1/1.0",
    incentivePolicyVersion: "SRRRO-V1",
    status: "SCHEDULED",
    departureAtUtc: new Date("2030-06-20T00:00:00.000Z")
  });
  assert.equal(
    inventoryRows.some((row) => row.departurePublicId === rows[0]!.publicId),
    true
  );
  assert.equal(demandRows[0]?.expectedTopOfferServiceCode, "HUE-NHA-0730");
});

test("keeps routeCode as physical route and serviceCode as the time variant", () => {
  const rows = loadTripScheduleRows(schedulePath, {
    pickupRows: loadPickupPointRows(pickupPath),
    policyRows: loadRevenueTwinPolicyRows(policyPath)
  });
  const hueRows = rows.filter((row) => row.routeCode === "HUE-NHA" && row.status === "SCHEDULED");

  assert.equal(
    hueRows.some((row) => row.serviceCode === "HUE-NHA-0700"),
    true
  );
  assert.equal(
    hueRows.some((row) => row.serviceCode === "HUE-NHA-0730"),
    true
  );
  assert.equal(
    hueRows.some((row) => row.serviceCode === "HUE-NHA-0800"),
    true
  );
  assert.equal(
    hueRows.every((row) => !/\d{3,4}/u.test(row.routeCode)),
    true
  );
});

test("maps schedule rows to the current trip_departures table without a migration", () => {
  const rows = loadTripScheduleRows(schedulePath, {
    pickupRows: loadPickupPointRows(pickupPath),
    policyRows: loadRevenueTwinPolicyRows(policyPath)
  });
  const departure = tripScheduleRowToDepartureSeed(rows[0]!);

  assert.deepEqual(departure, {
    publicId: "dep_demo_hue_nha_20300620_0700_own",
    routeCode: "HUE-NHA",
    routeFrom: "Hue",
    routeTo: "Nha Trang",
    departureAtUtc: new Date("2030-06-20T00:00:00.000Z"),
    departureTimezone: "Asia/Ho_Chi_Minh",
    capacity: 20,
    operationalStatus: "SCHEDULED",
    currency: "VND",
    farePerSeatMinor: 420000,
    depositAmountMinor: 50000,
    pricePolicyVersion: "BUS-PRICE-V1",
    refundPolicyVersion: "BUS-V1/1.0"
  });
});

test("rejects non-canonical schedule headers before accepting any row", () => {
  const filePath = writeTempFixture(
    [
      "publicId,routeCode,routeFrom,routeTo,localMonth,localDay,localTime,pickupPoints,capacity,farePerSeatMinor,depositAmountMinor,pricePolicyVersion,refundPolicyVersion",
      "dep_old,HUE-NHA,Hue,Nha Trang,5,25,07:00,HUE_TERMINAL,20,420000,50000,BUS-PRICE-V1,BUS-V1/1.0"
    ].join("\n")
  );

  assert.throws(
    () => loadTripScheduleRows(filePath),
    /trip-schedule-demo\.csv header must exactly match/u
  );
});

test("rejects duplicate public ids and duplicate natural keys with row numbers", () => {
  const pickupRows = loadPickupPointRows(pickupPath);
  const policyRows = loadRevenueTwinPolicyRows(policyPath);
  const duplicatePublicId = writeTempFixture(
    [
      scheduleHeader,
      "dep_x,HUE-NHA,HUE-NHA-0700,ctc_demo_own,OWN_FLEET,HUE,Hue,NHA,Nha Trang,2030-06-20,07:00,Asia/Ho_Chi_Minh,HUE_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED",
      "dep_x,HUE-NHA,HUE-NHA-0730,ctc_demo_own,OWN_FLEET,HUE,Hue,NHA,Nha Trang,2030-06-20,07:30,Asia/Ho_Chi_Minh,HUE_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
    ].join("\n")
  );
  const duplicateNaturalKey = writeTempFixture(
    [
      scheduleHeader,
      "dep_x,HUE-NHA,HUE-NHA-0700,ctc_demo_own,OWN_FLEET,HUE,Hue,NHA,Nha Trang,2030-06-20,07:00,Asia/Ho_Chi_Minh,HUE_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED",
      "dep_y,HUE-NHA,HUE-NHA-0700,ctc_demo_own,OWN_FLEET,HUE,Hue,NHA,Nha Trang,2030-06-20,07:00,Asia/Ho_Chi_Minh,HUE_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
    ].join("\n")
  );

  assert.throws(
    () => loadTripScheduleRows(duplicatePublicId, { pickupRows, policyRows }),
    /row 3: duplicate publicId dep_x/u
  );
  assert.throws(
    () => loadTripScheduleRows(duplicateNaturalKey, { pickupRows, policyRows }),
    /row 3: duplicate natural key/u
  );
});

test("rejects invalid schedule values instead of silently normalizing", () => {
  const pickupRows = loadPickupPointRows(pickupPath);
  const policyRows = loadRevenueTwinPolicyRows(policyPath);
  const invalid = writeTempFixture(
    [
      scheduleHeader,
      "dep_x,HUE-NHA-0700,HUE-NHA-0700,ctc_demo_own,OWN_FLEET,HUE,Hue,NHA,Nha Trang,20/06/2030,7:00,Asia/Bangkok,HUE_TERMINAL,0,-1,DEPOSIT_UNKNOWN,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
    ].join("\n")
  );

  assert.throws(
    () => loadTripScheduleRows(invalid, { pickupRows, policyRows }),
    /row 2: routeCode must not contain a time identity/u
  );
});

test("rejects each unsafe schedule value with a row-numbered reason", () => {
  const pickupRows = loadPickupPointRows(pickupPath);
  const policyRows = loadRevenueTwinPolicyRows(policyPath);
  const cases: Array<[Partial<Record<string, string>>, RegExp]> = [
    [{ serviceDate: "20/06/2030" }, /row 2: serviceDate must be YYYY-MM-DD/u],
    [{ serviceDate: "2030-02-31" }, /row 2: serviceDate must be a valid ISO date/u],
    [{ localTime: "7:00" }, /row 2: localTime must be HH:mm/u],
    [{ timezone: "Asia/Bangkok" }, /row 2: timezone must be Asia\/Ho_Chi_Minh/u],
    [
      { operatorRelation: "UNVERIFIED_PARTNER" },
      /row 2: operatorRelation must be OWN_FLEET or VERIFIED_PARTNER/u
    ],
    [{ status: "BOARDING" }, /row 2: status must be SCHEDULED or CANCELLED/u],
    [{ capacity: "0" }, /row 2: capacity must be positive/u],
    [{ farePerSeatMinor: "-1" }, /row 2: farePerSeatMinor must be a non-negative integer/u],
    [{ pickupPointCodes: "UNKNOWN_PICKUP" }, /row 2: unknown pickupPointCode UNKNOWN_PICKUP/u],
    [{ pricePolicyVersion: "UNKNOWN" }, /row 2: unknown pricePolicyVersion UNKNOWN/u],
    [{ refundPolicyVersion: "UNKNOWN" }, /row 2: unknown refundPolicyVersion UNKNOWN/u],
    [{ incentivePolicyVersion: "UNKNOWN" }, /row 2: unknown incentivePolicyVersion UNKNOWN/u]
  ];

  for (const [overrides, error] of cases) {
    assert.throws(
      () =>
        loadTripScheduleRows(writeTempFixture(validScheduleFixture(overrides)), {
          pickupRows,
          policyRows
        }),
      error
    );
  }
});

test("accepts cancelled control rows into the catalogue but maps them as non-scheduled", () => {
  const rows = loadTripScheduleRows(
    writeTempFixture(validScheduleFixture({ status: "CANCELLED" })),
    {
      pickupRows: loadPickupPointRows(pickupPath),
      policyRows: loadRevenueTwinPolicyRows(policyPath)
    }
  );

  assert.equal(rows[0]?.status, "CANCELLED");
  assert.equal(tripScheduleRowToDepartureSeed(rows[0]!).operationalStatus, "CANCELLED");
});
