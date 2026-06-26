import fs from "node:fs";

export type PickupPointRow = {
  pickupPointCode: string;
  routeFromCode: string;
  canonicalName: string;
  aliases: string[];
};

export type RevenueTwinPolicyRow = {
  policyVersion: string;
  enabled: boolean;
  maxDiscountAmountMinor: number;
  maxDiscountBasisPoints: number;
  minimumFinalFareAmountMinor: number;
  maximumAlternativeShiftMinutes: number;
  offerTtlSeconds: number;
  lowOccupancyThresholdBasisPoints: number;
  lowOccupancyDiscountMinor: number;
  mediumShiftThresholdMinutes: number;
  mediumShiftDiscountMinor: number;
  longShiftThresholdMinutes: number;
  longShiftDiscountMinor: number;
};

export type TripScheduleRow = {
  publicId: string;
  routeCode: string;
  serviceCode: string;
  operatorCode: string;
  operatorRelation: "OWN_FLEET" | "VERIFIED_PARTNER";
  routeFromCode: string;
  routeFrom: string;
  routeToCode: string;
  routeTo: string;
  serviceDate: string;
  localTime: string;
  timezone: "Asia/Ho_Chi_Minh";
  pickupPointCodes: string[];
  capacity: number;
  farePerSeatMinor: number;
  depositRuleCode: "DEPOSIT_50K";
  depositAmountMinor: number;
  pricePolicyVersion: string;
  refundPolicyVersion: string;
  incentivePolicyVersion: string;
  status: "SCHEDULED" | "CANCELLED";
  departureAtUtc: Date;
};

export type TripInventoryRow = {
  departurePublicId: string;
  confirmedSeatCount: number;
  activeHoldSeatCount: number;
  inventoryVersion: number;
  scenarioRole: string;
};

export type RevenueTwinDemandRow = {
  requestId: string;
  routeCode: string;
  serviceDate: string;
  preferredTime: string;
  passengerCount: number;
  flexBeforeMinutes: number;
  flexAfterMinutes: number;
  pickupPointCode: string;
  depositReadiness: "READY" | "UNKNOWN" | "NOT_READY";
  expectedStatus: string;
  expectedTopOfferServiceCode: string;
};

export type TripDepartureSeedRow = {
  publicId: string;
  catalogueSource: string;
  catalogueVersion: string;
  routeCode: string;
  routeFrom: string;
  routeTo: string;
  departureAtUtc: Date;
  departureTimezone: "Asia/Ho_Chi_Minh";
  pickupPointCodes: string[];
  capacity: number;
  operationalStatus: "SCHEDULED" | "CANCELLED";
  currency: "VND";
  farePerSeatMinor: number;
  depositAmountMinor: number;
  pricePolicyVersion: string;
  refundPolicyVersion: string;
};

export type DemoCatalogueFixtureSet = {
  scheduleRows: readonly TripScheduleRow[];
  pickupRows?: readonly PickupPointRow[];
  inventoryRows?: readonly TripInventoryRow[];
  now?: Date;
};

type CatalogueTransaction = {
  $transaction?: never;
  tripDeparture: {
    upsert(input: Record<string, unknown>): Promise<{ id: string; publicId: string }>;
    updateMany(input: Record<string, unknown>): Promise<unknown>;
    findUniqueOrThrow(input: Record<string, unknown>): Promise<{
      id: string;
      publicId: string;
      routeFrom: string;
      routeTo: string;
      departureAtUtc: Date;
      farePerSeatMinor: number;
      depositAmountMinor: number;
      refundPolicyVersion: string;
    }>;
  };
  cataloguePickupPoint: {
    upsert(input: Record<string, unknown>): Promise<unknown>;
    updateMany(input: Record<string, unknown>): Promise<unknown>;
  };
  booking: {
    upsert(input: Record<string, unknown>): Promise<{ id: string }>;
  };
  inventoryHold: {
    upsert(input: Record<string, unknown>): Promise<unknown>;
  };
};

type CatalogueClient = {
  $transaction<T>(
    operation: (transaction: CatalogueTransaction) => Promise<T>,
    options?: Record<string, unknown>
  ): Promise<T>;
};

const SCHEDULE_HEADERS = [
  "publicId",
  "routeCode",
  "serviceCode",
  "operatorCode",
  "operatorRelation",
  "routeFromCode",
  "routeFrom",
  "routeToCode",
  "routeTo",
  "serviceDate",
  "localTime",
  "timezone",
  "pickupPointCodes",
  "capacity",
  "farePerSeatMinor",
  "depositRuleCode",
  "pricePolicyVersion",
  "refundPolicyVersion",
  "incentivePolicyVersion",
  "status"
] as const;

const PICKUP_HEADERS = ["pickupPointCode", "routeFromCode", "canonicalName", "aliases"] as const;

const INVENTORY_HEADERS = [
  "departurePublicId",
  "confirmedSeatCount",
  "activeHoldSeatCount",
  "inventoryVersion",
  "scenarioRole"
] as const;

const DEMAND_HEADERS = [
  "requestId",
  "routeCode",
  "serviceDate",
  "preferredTime",
  "passengerCount",
  "flexBeforeMinutes",
  "flexAfterMinutes",
  "pickupPointCode",
  "depositReadiness",
  "expectedStatus",
  "expectedTopOfferServiceCode"
] as const;

const POLICY_HEADERS = [
  "policyVersion",
  "enabled",
  "maxDiscountAmountMinor",
  "maxDiscountBasisPoints",
  "minimumFinalFareAmountMinor",
  "maximumAlternativeShiftMinutes",
  "offerTtlSeconds",
  "lowOccupancyThresholdBasisPoints",
  "lowOccupancyDiscountMinor",
  "mediumShiftThresholdMinutes",
  "mediumShiftDiscountMinor",
  "longShiftThresholdMinutes",
  "longShiftDiscountMinor"
] as const;

const DEPOSIT_RULES = {
  DEPOSIT_50K: 50_000
} as const;

export const DEMO_CATALOGUE_SOURCE = "DEMO_CSV";
export const DEMO_CATALOGUE_VERSION = "trip-schedule-demo:v1";

const KNOWN_PRICE_POLICIES = new Set(["BUS-PRICE-V1"]);
const KNOWN_REFUND_POLICIES = new Set(["BUS-V1/1.0"]);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function readCsv(filePath: string): { headers: string[]; records: Array<Record<string, string>> } {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length === 0) return { headers: [], records: [] };
  const headers = parseCsvLine(lines[0] ?? "");
  return {
    headers,
    records: lines.slice(1).map((line, index) => ({
      __row: String(index + 2),
      ...Object.fromEntries(
        headers.map((header, cellIndex) => [header, parseCsvLine(line)[cellIndex] ?? ""])
      )
    }))
  };
}

function assertExactHeaders(
  actual: readonly string[],
  expected: readonly string[],
  fixtureName: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((header, index) => header !== expected[index])
  ) {
    throw new Error(`${fixtureName} header must exactly match: ${expected.join(",")}`);
  }
}

function rowError(record: Record<string, string>, message: string): Error {
  return new Error(`row ${record.__row ?? "?"}: ${message}`);
}

function required(record: Record<string, string>, field: string): string {
  const value = record[field]?.trim() ?? "";
  if (value.length === 0) throw rowError(record, `${field} is required`);
  return value;
}

function nonNegativeInteger(record: Record<string, string>, field: string): number {
  const value = required(record, field);
  if (!/^\d+$/u.test(value)) throw rowError(record, `${field} must be a non-negative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw rowError(record, `${field} must be safe integer`);
  return parsed;
}

function positiveInteger(record: Record<string, string>, field: string): number {
  const parsed = nonNegativeInteger(record, field);
  if (parsed <= 0) throw rowError(record, `${field} must be positive`);
  return parsed;
}

function parseBoolean(record: Record<string, string>, field: string): boolean {
  const value = required(record, field);
  if (value === "true") return true;
  if (value === "false") return false;
  throw rowError(record, `${field} must be true or false`);
}

function assertIsoDate(record: Record<string, string>, field: string): string {
  const value = required(record, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw rowError(record, `${field} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw rowError(record, `${field} must be a valid ISO date`);
  }
  return value;
}

function assertLocalTime(record: Record<string, string>, field: string): string {
  const value = required(record, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) throw rowError(record, `${field} must be HH:mm`);
  return value;
}

function departureAtUtc(serviceDate: string, localTime: string): Date {
  const [year, month, day] = serviceDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, hour! - 7, minute!, 0, 0));
}

export function loadPickupPointRows(filePath: string): PickupPointRow[] {
  const csv = readCsv(filePath);
  assertExactHeaders(csv.headers, PICKUP_HEADERS, "pickup-point-demo.csv");
  const seen = new Set<string>();
  return csv.records.map((record) => {
    const pickupPointCode = required(record, "pickupPointCode");
    if (seen.has(pickupPointCode))
      throw rowError(record, `duplicate pickupPointCode ${pickupPointCode}`);
    seen.add(pickupPointCode);
    return {
      pickupPointCode,
      routeFromCode: required(record, "routeFromCode"),
      canonicalName: required(record, "canonicalName"),
      aliases: required(record, "aliases")
        .split("|")
        .map((alias) => alias.trim())
        .filter(Boolean)
    };
  });
}

export function loadRevenueTwinPolicyRows(filePath: string): RevenueTwinPolicyRow[] {
  const csv = readCsv(filePath);
  assertExactHeaders(csv.headers, POLICY_HEADERS, "revenue-twin-policy-demo.csv");
  const seen = new Set<string>();
  return csv.records.map((record) => {
    const policyVersion = required(record, "policyVersion");
    if (seen.has(policyVersion)) throw rowError(record, `duplicate policyVersion ${policyVersion}`);
    seen.add(policyVersion);
    return {
      policyVersion,
      enabled: parseBoolean(record, "enabled"),
      maxDiscountAmountMinor: nonNegativeInteger(record, "maxDiscountAmountMinor"),
      maxDiscountBasisPoints: nonNegativeInteger(record, "maxDiscountBasisPoints"),
      minimumFinalFareAmountMinor: nonNegativeInteger(record, "minimumFinalFareAmountMinor"),
      maximumAlternativeShiftMinutes: nonNegativeInteger(record, "maximumAlternativeShiftMinutes"),
      offerTtlSeconds: positiveInteger(record, "offerTtlSeconds"),
      lowOccupancyThresholdBasisPoints: nonNegativeInteger(
        record,
        "lowOccupancyThresholdBasisPoints"
      ),
      lowOccupancyDiscountMinor: nonNegativeInteger(record, "lowOccupancyDiscountMinor"),
      mediumShiftThresholdMinutes: nonNegativeInteger(record, "mediumShiftThresholdMinutes"),
      mediumShiftDiscountMinor: nonNegativeInteger(record, "mediumShiftDiscountMinor"),
      longShiftThresholdMinutes: nonNegativeInteger(record, "longShiftThresholdMinutes"),
      longShiftDiscountMinor: nonNegativeInteger(record, "longShiftDiscountMinor")
    };
  });
}

export function loadTripScheduleRows(
  filePath: string,
  options: {
    pickupRows?: readonly PickupPointRow[];
    policyRows?: readonly RevenueTwinPolicyRow[];
  } = {}
): TripScheduleRow[] {
  const csv = readCsv(filePath);
  assertExactHeaders(csv.headers, SCHEDULE_HEADERS, "trip-schedule-demo.csv");
  const pickupCodes = new Set((options.pickupRows ?? []).map((row) => row.pickupPointCode));
  const incentivePolicyVersions = new Set(
    (options.policyRows ?? []).map((row) => row.policyVersion)
  );
  const publicIds = new Set<string>();
  const naturalKeys = new Set<string>();

  return csv.records.map((record) => {
    const publicId = required(record, "publicId");
    if (publicIds.has(publicId)) throw rowError(record, `duplicate publicId ${publicId}`);
    publicIds.add(publicId);

    const routeCode = required(record, "routeCode");
    if (/\d{3,4}/u.test(routeCode))
      throw rowError(record, "routeCode must not contain a time identity");
    const serviceCode = required(record, "serviceCode");
    const operatorCode = required(record, "operatorCode");
    const operatorRelation = required(record, "operatorRelation");
    if (operatorRelation !== "OWN_FLEET" && operatorRelation !== "VERIFIED_PARTNER") {
      throw rowError(record, "operatorRelation must be OWN_FLEET or VERIFIED_PARTNER");
    }
    const serviceDate = assertIsoDate(record, "serviceDate");
    const localTime = assertLocalTime(record, "localTime");
    const timezone = required(record, "timezone");
    if (timezone !== "Asia/Ho_Chi_Minh")
      throw rowError(record, "timezone must be Asia/Ho_Chi_Minh");
    const naturalKey = [operatorCode, routeCode, serviceDate, localTime, serviceCode].join("|");
    if (naturalKeys.has(naturalKey)) throw rowError(record, `duplicate natural key ${naturalKey}`);
    naturalKeys.add(naturalKey);

    const pickupPointCodes = required(record, "pickupPointCodes")
      .split("|")
      .map((code) => code.trim())
      .filter(Boolean);
    if (pickupPointCodes.length === 0) throw rowError(record, "pickupPointCodes is required");
    for (const code of pickupPointCodes) {
      if (pickupCodes.size > 0 && !pickupCodes.has(code)) {
        throw rowError(record, `unknown pickupPointCode ${code}`);
      }
    }

    const depositRuleCode = required(record, "depositRuleCode");
    if (depositRuleCode !== "DEPOSIT_50K")
      throw rowError(record, "depositRuleCode must be DEPOSIT_50K");
    const pricePolicyVersion = required(record, "pricePolicyVersion");
    if (!KNOWN_PRICE_POLICIES.has(pricePolicyVersion))
      throw rowError(record, `unknown pricePolicyVersion ${pricePolicyVersion}`);
    const refundPolicyVersion = required(record, "refundPolicyVersion");
    if (!KNOWN_REFUND_POLICIES.has(refundPolicyVersion))
      throw rowError(record, `unknown refundPolicyVersion ${refundPolicyVersion}`);
    const incentivePolicyVersion = required(record, "incentivePolicyVersion");
    if (incentivePolicyVersions.size > 0 && !incentivePolicyVersions.has(incentivePolicyVersion)) {
      throw rowError(record, `unknown incentivePolicyVersion ${incentivePolicyVersion}`);
    }
    const status = required(record, "status");
    if (status !== "SCHEDULED" && status !== "CANCELLED") {
      throw rowError(record, "status must be SCHEDULED or CANCELLED");
    }

    return {
      publicId,
      routeCode,
      serviceCode,
      operatorCode,
      operatorRelation,
      routeFromCode: required(record, "routeFromCode"),
      routeFrom: required(record, "routeFrom"),
      routeToCode: required(record, "routeToCode"),
      routeTo: required(record, "routeTo"),
      serviceDate,
      localTime,
      timezone,
      pickupPointCodes,
      capacity: positiveInteger(record, "capacity"),
      farePerSeatMinor: nonNegativeInteger(record, "farePerSeatMinor"),
      depositRuleCode,
      depositAmountMinor: DEPOSIT_RULES[depositRuleCode],
      pricePolicyVersion,
      refundPolicyVersion,
      incentivePolicyVersion,
      status,
      departureAtUtc: departureAtUtc(serviceDate, localTime)
    };
  });
}

export function loadTripInventoryRows(
  filePath: string,
  scheduleRows: readonly TripScheduleRow[] = []
): TripInventoryRow[] {
  const csv = readCsv(filePath);
  assertExactHeaders(csv.headers, INVENTORY_HEADERS, "trip-inventory-demo.csv");
  const departures = new Map(scheduleRows.map((row) => [row.publicId, row]));
  return csv.records.map((record) => {
    const departurePublicId = required(record, "departurePublicId");
    const scheduleRow = departures.get(departurePublicId);
    if (departures.size > 0 && scheduleRow === undefined) {
      throw rowError(record, `unknown departurePublicId ${departurePublicId}`);
    }
    const confirmedSeatCount = nonNegativeInteger(record, "confirmedSeatCount");
    const activeHoldSeatCount = nonNegativeInteger(record, "activeHoldSeatCount");
    if (
      scheduleRow !== undefined &&
      confirmedSeatCount + activeHoldSeatCount > scheduleRow.capacity
    ) {
      throw rowError(record, "inventory exceeds schedule capacity");
    }
    return {
      departurePublicId,
      confirmedSeatCount,
      activeHoldSeatCount,
      inventoryVersion: positiveInteger(record, "inventoryVersion"),
      scenarioRole: required(record, "scenarioRole")
    };
  });
}

export function loadRevenueTwinDemandRows(
  filePath: string,
  pickupRows: readonly PickupPointRow[] = []
): RevenueTwinDemandRow[] {
  const csv = readCsv(filePath);
  assertExactHeaders(csv.headers, DEMAND_HEADERS, "revenue-twin-demand-demo.csv");
  const pickupCodes = new Set(pickupRows.map((row) => row.pickupPointCode));
  return csv.records.map((record) => {
    const pickupPointCode = required(record, "pickupPointCode");
    if (pickupCodes.size > 0 && !pickupCodes.has(pickupPointCode)) {
      throw rowError(record, `unknown pickupPointCode ${pickupPointCode}`);
    }
    const depositReadiness = required(record, "depositReadiness");
    if (!["READY", "UNKNOWN", "NOT_READY"].includes(depositReadiness)) {
      throw rowError(record, "depositReadiness must be READY, UNKNOWN, or NOT_READY");
    }
    return {
      requestId: required(record, "requestId"),
      routeCode: required(record, "routeCode"),
      serviceDate: assertIsoDate(record, "serviceDate"),
      preferredTime: assertLocalTime(record, "preferredTime"),
      passengerCount: positiveInteger(record, "passengerCount"),
      flexBeforeMinutes: nonNegativeInteger(record, "flexBeforeMinutes"),
      flexAfterMinutes: nonNegativeInteger(record, "flexAfterMinutes"),
      pickupPointCode,
      depositReadiness: depositReadiness as RevenueTwinDemandRow["depositReadiness"],
      expectedStatus: required(record, "expectedStatus"),
      expectedTopOfferServiceCode: record.expectedTopOfferServiceCode?.trim() ?? ""
    };
  });
}

export function tripScheduleRowToDepartureSeed(row: TripScheduleRow): TripDepartureSeedRow {
  return {
    publicId: row.publicId,
    catalogueSource: DEMO_CATALOGUE_SOURCE,
    catalogueVersion: DEMO_CATALOGUE_VERSION,
    routeCode: row.routeCode,
    routeFrom: row.routeFrom,
    routeTo: row.routeTo,
    departureAtUtc: row.departureAtUtc,
    departureTimezone: row.timezone,
    pickupPointCodes: row.pickupPointCodes,
    capacity: row.capacity,
    operationalStatus: row.status,
    currency: "VND",
    farePerSeatMinor: row.farePerSeatMinor,
    depositAmountMinor: row.depositAmountMinor,
    pricePolicyVersion: row.pricePolicyVersion,
    refundPolicyVersion: row.refundPolicyVersion
  };
}

async function upsertTripDeparture(
  transaction: CatalogueTransaction,
  row: TripDepartureSeedRow,
  version?: number
) {
  const data = {
    catalogueSource: row.catalogueSource,
    catalogueVersion: row.catalogueVersion,
    routeCode: row.routeCode,
    routeFrom: row.routeFrom,
    routeTo: row.routeTo,
    departureAtUtc: row.departureAtUtc,
    departureTimezone: row.departureTimezone,
    pickupPointCodes: row.pickupPointCodes,
    capacity: row.capacity,
    operationalStatus: row.operationalStatus,
    currency: row.currency,
    farePerSeatMinor: row.farePerSeatMinor,
    depositAmountMinor: row.depositAmountMinor,
    pricePolicyVersion: row.pricePolicyVersion,
    refundPolicyVersion: row.refundPolicyVersion,
    ...(version === undefined ? {} : { version })
  };
  return transaction.tripDeparture.upsert({
    where: { publicId: row.publicId },
    update: data,
    create: {
      publicId: row.publicId,
      ...data
    }
  });
}

async function upsertPickupPoint(
  transaction: CatalogueTransaction,
  row: PickupPointRow
): Promise<void> {
  await transaction.cataloguePickupPoint.upsert({
    where: {
      catalogueSource_catalogueVersion_pickupPointCode: {
        catalogueSource: DEMO_CATALOGUE_SOURCE,
        catalogueVersion: DEMO_CATALOGUE_VERSION,
        pickupPointCode: row.pickupPointCode
      }
    },
    update: {
      routeFromCode: row.routeFromCode,
      canonicalName: row.canonicalName,
      aliases: row.aliases,
      active: true
    },
    create: {
      publicId: `pickup_${row.pickupPointCode}`,
      catalogueSource: DEMO_CATALOGUE_SOURCE,
      catalogueVersion: DEMO_CATALOGUE_VERSION,
      pickupPointCode: row.pickupPointCode,
      routeFromCode: row.routeFromCode,
      canonicalName: row.canonicalName,
      aliases: row.aliases,
      active: true
    }
  });
}

async function upsertInventoryScenarioHold(input: {
  transaction: CatalogueTransaction;
  departure: {
    id: string;
    publicId: string;
    routeFrom: string;
    routeTo: string;
    departureAtUtc: Date;
    farePerSeatMinor: number;
    depositAmountMinor: number;
    refundPolicyVersion: string;
  };
  row: TripInventoryRow;
  quantity: number;
  kind: "confirmed" | "active";
  now: Date;
}) {
  if (input.quantity <= 0) return;
  const publicId = `bk_demo_inventory_${input.departure.publicId}_${input.kind}`;
  const booking = await input.transaction.booking.upsert({
    where: { publicId },
    update: {
      tripDepartureId: input.departure.id,
      status: input.kind === "confirmed" ? "AGREEMENT_LOCKED" : "AGREEMENT_READY",
      routeFrom: input.departure.routeFrom,
      routeTo: input.departure.routeTo,
      departureAtUtc: input.departure.departureAtUtc,
      passengerCount: input.quantity,
      totalAmountMinor: input.departure.farePerSeatMinor * input.quantity,
      depositAmountMinor: input.departure.depositAmountMinor,
      refundPolicyVersion: input.departure.refundPolicyVersion
    },
    create: {
      publicId,
      tripDepartureId: input.departure.id,
      status: input.kind === "confirmed" ? "AGREEMENT_LOCKED" : "AGREEMENT_READY",
      routeFrom: input.departure.routeFrom,
      routeTo: input.departure.routeTo,
      departureAtUtc: input.departure.departureAtUtc,
      passengerCount: input.quantity,
      totalAmountMinor: input.departure.farePerSeatMinor * input.quantity,
      depositAmountMinor: input.departure.depositAmountMinor,
      refundPolicyVersion: input.departure.refundPolicyVersion
    }
  });
  const expiresAt = new Date(input.now.getTime() + 365 * 24 * 60 * 60_000);
  const status = input.kind === "confirmed" ? "CONSUMED" : "ACTIVE";
  await input.transaction.inventoryHold.upsert({
    where: { idempotencyKey: `seed-${publicId}` },
    update: {
      bookingId: booking.id,
      departureId: input.departure.id,
      quantity: input.quantity,
      status,
      expiresAt,
      consumedAt: status === "CONSUMED" ? input.now : null,
      releasedAt: null
    },
    create: {
      publicId: `hold_demo_inventory_${input.departure.publicId}_${input.kind}`,
      idempotencyKey: `seed-${publicId}`,
      bookingId: booking.id,
      departureId: input.departure.id,
      quantity: input.quantity,
      status,
      expiresAt,
      consumedAt: status === "CONSUMED" ? input.now : null
    }
  });
}

export async function applyDemoCatalogueFixtures(
  client: CatalogueClient,
  fixtures: DemoCatalogueFixtureSet
): Promise<void> {
  const inventoryByDeparture = new Map(
    (fixtures.inventoryRows ?? []).map((row) => [row.departurePublicId, row])
  );
  const now = fixtures.now ?? new Date();

  await client.$transaction(async (transaction) => {
    const currentDepartureIds = fixtures.scheduleRows.map((row) => row.publicId);
    const currentPickupCodes = (fixtures.pickupRows ?? []).map((row) => row.pickupPointCode);

    await transaction.tripDeparture.updateMany({
      where: {
        catalogueSource: DEMO_CATALOGUE_SOURCE,
        catalogueVersion: DEMO_CATALOGUE_VERSION,
        publicId: { notIn: currentDepartureIds }
      },
      data: {
        operationalStatus: "CANCELLED"
      }
    });
    await transaction.cataloguePickupPoint.updateMany({
      where: {
        catalogueSource: DEMO_CATALOGUE_SOURCE,
        catalogueVersion: DEMO_CATALOGUE_VERSION,
        pickupPointCode: { notIn: currentPickupCodes }
      },
      data: { active: false }
    });

    for (const pickupRow of fixtures.pickupRows ?? []) {
      await upsertPickupPoint(transaction, pickupRow);
    }

    for (const scheduleRow of fixtures.scheduleRows) {
      const inventory = inventoryByDeparture.get(scheduleRow.publicId);
      await upsertTripDeparture(
        transaction,
        tripScheduleRowToDepartureSeed(scheduleRow),
        inventory?.inventoryVersion
      );
    }

    for (const inventoryRow of fixtures.inventoryRows ?? []) {
      const departure = await transaction.tripDeparture.findUniqueOrThrow({
        where: { publicId: inventoryRow.departurePublicId }
      });
      await upsertInventoryScenarioHold({
        transaction,
        departure,
        row: inventoryRow,
        quantity: inventoryRow.confirmedSeatCount,
        kind: "confirmed",
        now
      });
      await upsertInventoryScenarioHold({
        transaction,
        departure,
        row: inventoryRow,
        quantity: inventoryRow.activeHoldSeatCount,
        kind: "active",
        now
      });
    }
  });
}
