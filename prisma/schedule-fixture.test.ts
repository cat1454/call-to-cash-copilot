import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  DEMO_CATALOGUE_SOURCE,
  DEMO_CATALOGUE_VERSION,
  applyDemoCatalogueFixtures,
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
    routeCode: "DAD-NHA",
    serviceCode: "DAD-NHA-0700",
    operatorCode: "ctc_demo_own",
    operatorRelation: "OWN_FLEET",
    routeFromCode: "DAD",
    routeFrom: "Da Nang",
    routeToCode: "NHA",
    routeTo: "Nha Trang",
    serviceDate: "2026-06-28",
    localTime: "07:00",
    timezone: "Asia/Ho_Chi_Minh",
    pickupPointCodes: "DAD_TERMINAL",
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

  assert.equal(new Set(rows.map((row) => row.routeCode)).size, 1);
  assert.equal(
    rows.every((row) => row.routeCode === "DAD-NHA"),
    true
  );
  assert.equal(rows.filter((row) => row.status === "SCHEDULED").length, 3);
  assert.deepEqual(rows[0], {
    publicId: "dep_demo_dad_nha_20260628_0700_own",
    routeCode: "DAD-NHA",
    serviceCode: "DAD-NHA-0700",
    operatorCode: "ctc_demo_own",
    operatorRelation: "OWN_FLEET",
    routeFromCode: "DAD",
    routeFrom: "Da Nang",
    routeToCode: "NHA",
    routeTo: "Nha Trang",
    serviceDate: "2026-06-28",
    localTime: "07:00",
    timezone: "Asia/Ho_Chi_Minh",
    pickupPointCodes: ["DAD_TERMINAL", "DAD_CENTER"],
    capacity: 20,
    farePerSeatMinor: 420000,
    depositRuleCode: "DEPOSIT_50K",
    depositAmountMinor: 50000,
    pricePolicyVersion: "BUS-PRICE-V1",
    refundPolicyVersion: "BUS-V1/1.0",
    incentivePolicyVersion: "SRRRO-V1",
    status: "SCHEDULED",
    departureAtUtc: new Date("2026-06-28T00:00:00.000Z")
  });
  assert.equal(
    inventoryRows.some((row) => row.departurePublicId === rows[0]!.publicId),
    true
  );
  assert.equal(demandRows.length, 1);
  assert.equal(demandRows[0]?.routeCode, "DAD-NHA");
  assert.equal(demandRows[0]?.expectedTopOfferServiceCode, "DAD-NHA-0730");
});

test("keeps routeCode as physical route and serviceCode as the time variant", () => {
  const rows = loadTripScheduleRows(schedulePath, {
    pickupRows: loadPickupPointRows(pickupPath),
    policyRows: loadRevenueTwinPolicyRows(policyPath)
  });
  const daNangRows = rows.filter(
    (row) => row.routeCode === "DAD-NHA" && row.status === "SCHEDULED"
  );

  assert.equal(
    daNangRows.some((row) => row.serviceCode === "DAD-NHA-0700"),
    true
  );
  assert.equal(
    daNangRows.some((row) => row.serviceCode === "DAD-NHA-0730"),
    true
  );
  assert.equal(
    daNangRows.some((row) => row.serviceCode === "DAD-NHA-0800"),
    true
  );
  assert.equal(
    daNangRows.every((row) => !/\d{3,4}/u.test(row.routeCode)),
    true
  );
});

test("maps schedule rows to the current catalogue-aware trip_departures table", () => {
  const rows = loadTripScheduleRows(schedulePath, {
    pickupRows: loadPickupPointRows(pickupPath),
    policyRows: loadRevenueTwinPolicyRows(policyPath)
  });
  const departure = tripScheduleRowToDepartureSeed(rows[0]!);

  assert.deepEqual(departure, {
    publicId: "dep_demo_dad_nha_20260628_0700_own",
    catalogueSource: DEMO_CATALOGUE_SOURCE,
    catalogueVersion: DEMO_CATALOGUE_VERSION,
    routeCode: "DAD-NHA",
    routeFrom: "Da Nang",
    routeTo: "Nha Trang",
    departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
    departureTimezone: "Asia/Ho_Chi_Minh",
    pickupPointCodes: ["DAD_TERMINAL", "DAD_CENTER"],
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
      "dep_old,DAD-NHA,Da Nang,Nha Trang,5,25,07:00,DAD_TERMINAL,20,420000,50000,BUS-PRICE-V1,BUS-V1/1.0"
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
      "dep_x,DAD-NHA,DAD-NHA-0700,ctc_demo_own,OWN_FLEET,DAD,Da Nang,NHA,Nha Trang,2026-06-28,07:00,Asia/Ho_Chi_Minh,DAD_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED",
      "dep_x,DAD-NHA,DAD-NHA-0730,ctc_demo_own,OWN_FLEET,DAD,Da Nang,NHA,Nha Trang,2026-06-28,07:30,Asia/Ho_Chi_Minh,DAD_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
    ].join("\n")
  );
  const duplicateNaturalKey = writeTempFixture(
    [
      scheduleHeader,
      "dep_x,DAD-NHA,DAD-NHA-0700,ctc_demo_own,OWN_FLEET,DAD,Da Nang,NHA,Nha Trang,2026-06-28,07:00,Asia/Ho_Chi_Minh,DAD_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED",
      "dep_y,DAD-NHA,DAD-NHA-0700,ctc_demo_own,OWN_FLEET,DAD,Da Nang,NHA,Nha Trang,2026-06-28,07:00,Asia/Ho_Chi_Minh,DAD_TERMINAL,20,420000,DEPOSIT_50K,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
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
      "dep_x,DAD-NHA-0700,DAD-NHA-0700,ctc_demo_own,OWN_FLEET,DAD,Da Nang,NHA,Nha Trang,28/06/2026,7:00,Asia/Bangkok,DAD_TERMINAL,0,-1,DEPOSIT_UNKNOWN,BUS-PRICE-V1,BUS-V1/1.0,SRRRO-V1,SCHEDULED"
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

test("demo catalogue seed deactivates stale demo departures and pickup aliases only inside its namespace", async () => {
  const operations: Array<{ model: string; input: Record<string, unknown> }> = [];
  const transaction = {
    tripDeparture: {
      updateMany: async (input: Record<string, unknown>) => {
        operations.push({ model: "tripDeparture.updateMany", input });
        return {};
      },
      upsert: async (input: Record<string, unknown>) => {
        operations.push({ model: "tripDeparture.upsert", input });
        return { id: "dep_internal", publicId: "dep_demo_dad_nha_20260628_0700_own" };
      },
      findUniqueOrThrow: async () => ({
        id: "dep_internal",
        publicId: "dep_demo_dad_nha_20260628_0700_own",
        routeFrom: "Da Nang",
        routeTo: "Nha Trang",
        departureAtUtc: new Date("2026-06-28T00:00:00.000Z"),
        farePerSeatMinor: 420000,
        depositAmountMinor: 50000,
        refundPolicyVersion: "BUS-V1/1.0"
      })
    },
    cataloguePickupPoint: {
      updateMany: async (input: Record<string, unknown>) => {
        operations.push({ model: "cataloguePickupPoint.updateMany", input });
        return {};
      },
      upsert: async (input: Record<string, unknown>) => {
        operations.push({ model: "cataloguePickupPoint.upsert", input });
        return {};
      }
    },
    booking: { upsert: async () => ({ id: "booking_internal" }) },
    inventoryHold: { upsert: async () => ({}) }
  };
  const client = {
    $transaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) =>
      operation(transaction)
  };
  const pickupRows = loadPickupPointRows(pickupPath);
  const scheduleRows = loadTripScheduleRows(schedulePath, {
    pickupRows,
    policyRows: loadRevenueTwinPolicyRows(policyPath)
  }).slice(0, 1);

  await applyDemoCatalogueFixtures(client, { scheduleRows, pickupRows });

  assert.deepEqual(operations[0], {
    model: "tripDeparture.updateMany",
    input: {
      where: {
        catalogueSource: DEMO_CATALOGUE_SOURCE,
        catalogueVersion: DEMO_CATALOGUE_VERSION,
        publicId: { notIn: ["dep_demo_dad_nha_20260628_0700_own"] }
      },
      data: { operationalStatus: "CANCELLED" }
    }
  });
  assert.deepEqual(operations[1], {
    model: "cataloguePickupPoint.updateMany",
    input: {
      where: {
        catalogueSource: DEMO_CATALOGUE_SOURCE,
        catalogueVersion: DEMO_CATALOGUE_VERSION,
        pickupPointCode: { notIn: ["DAD_TERMINAL", "DAD_CENTER"] }
      },
      data: { active: false }
    }
  });
  assert.equal(
    operations.some(
      (operation) =>
        operation.model === "tripDeparture.updateMany" &&
        JSON.stringify(operation.input).includes("LEGACY")
    ),
    false
  );
});
