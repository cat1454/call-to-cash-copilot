import fs from "node:fs";

export type TripScheduleRow = {
  publicId: string;
  routeCode: string;
  routeFrom: string;
  routeTo: string;
  departureAtUtc: Date;
  departureTimezone: "Asia/Ho_Chi_Minh";
  capacity: number;
  operationalStatus: "SCHEDULED";
  currency: "VND";
  farePerSeatMinor: number;
  depositAmountMinor: number;
  pricePolicyVersion: string;
  refundPolicyVersion: string;
  pickupPoints: string[];
};

const REQUIRED_HEADERS = [
  "publicId",
  "routeCode",
  "routeFrom",
  "routeTo",
  "localMonth",
  "localDay",
  "localTime",
  "pickupPoints",
  "capacity",
  "farePerSeatMinor",
  "depositAmountMinor",
  "pricePolicyVersion",
  "refundPolicyVersion"
] as const;

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

function asPositiveInteger(value: string, field: string): number {
  if (!/^\d+$/u.test(value)) throw new Error(`Invalid ${field}: expected positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field}: expected positive integer`);
  }
  return parsed;
}

export function nextVietnamScheduleDate(
  month: number,
  day: number,
  localTime: string,
  now = new Date()
): Date {
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(localTime);
  if (time === null) throw new Error(`Invalid localTime: ${localTime}`);
  const localYear = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(now)
  );
  const toUtc = (year: number) =>
    new Date(Date.UTC(year, month - 1, day, Number(time[1]) - 7, Number(time[2]), 0, 0));
  const thisYear = toUtc(localYear);
  return thisYear > now ? thisYear : toUtc(localYear + 1);
}

export function loadTripScheduleRows(filePath: string, now = new Date()): TripScheduleRow[] {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0] ?? "");
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0)
    throw new Error(`Trip schedule is missing columns: ${missing.join(", ")}`);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const month = asPositiveInteger(record.localMonth ?? "", "localMonth");
    const day = asPositiveInteger(record.localDay ?? "", "localDay");
    const capacity = asPositiveInteger(record.capacity ?? "", "capacity");
    const farePerSeatMinor = asPositiveInteger(record.farePerSeatMinor ?? "", "farePerSeatMinor");
    const depositAmountMinor = asPositiveInteger(
      record.depositAmountMinor ?? "",
      "depositAmountMinor"
    );
    if (depositAmountMinor > farePerSeatMinor * capacity) {
      throw new Error(
        `Invalid depositAmountMinor for ${record.publicId}: exceeds full capacity fare`
      );
    }
    const pickupPoints = (record.pickupPoints ?? "")
      .split("|")
      .map((point) => point.trim())
      .filter(Boolean);
    if (pickupPoints.length === 0) throw new Error(`Missing pickupPoints for ${record.publicId}`);

    return {
      publicId: record.publicId ?? "",
      routeCode: record.routeCode ?? "",
      routeFrom: record.routeFrom ?? "",
      routeTo: record.routeTo ?? "",
      departureAtUtc: nextVietnamScheduleDate(month, day, record.localTime ?? "", now),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor,
      depositAmountMinor,
      pricePolicyVersion: record.pricePolicyVersion ?? "",
      refundPolicyVersion: record.refundPolicyVersion ?? "",
      pickupPoints
    };
  });
}
