import { maskPhone } from "../call-session.presenter.js";
import type { ExtractedFacts } from "../types.js";
import { normalizeForSearch } from "./replay-normalizer.js";

type DepartureCandidate = {
  routeFrom: string;
  routeTo: string;
  departureAtUtc: Date;
  pickupPoints?: string[];
};

type ExtractionOptions = {
  departures?: readonly DepartureCandidate[];
  now?: Date;
};

const NUMBER_UNITS: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9
};
const PHONE_DIGIT_WORDS = Object.keys(NUMBER_UNITS).sort(
  (left, right) => right.length - left.length
);
const UNIT_WORD = "(?:khong|mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin)";
const NUMBER_EXPRESSION = `(?:\\d{1,2}|${UNIT_WORD}\\s+muoi(?:\\s+${UNIT_WORD})?|muoi(?:\\s+${UNIT_WORD})?|${UNIT_WORD})`;

function parseNumber(expression: string | undefined): number | undefined {
  if (expression === undefined) return undefined;
  if (/^\d{1,2}$/u.test(expression)) return Number(expression);
  const words = expression.trim().split(/\s+/u);
  if (words[0] === "muoi") return 10 + (NUMBER_UNITS[words[1] ?? ""] ?? 0);
  if (words[1] === "muoi") {
    return (NUMBER_UNITS[words[0] ?? ""] ?? 0) * 10 + (NUMBER_UNITS[words[2] ?? ""] ?? 0);
  }
  return NUMBER_UNITS[words[0] ?? ""];
}

function findSpokenLocation(normalized: string, location: string, startAt = 0) {
  const expression = locationExpression(location);
  const match = new RegExp(`\\b${expression}\\b`, "u").exec(normalized.slice(startAt));
  if (match === null || match.index === undefined) return null;
  const index = startAt + match.index;
  return { index, end: index + match[0].length };
}

function locationExpression(location: string) {
  return normalizeForSearch(location)
    .trim()
    .split(/\s+/u)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("\\s*");
}

function routePatternMatches(
  normalized: string,
  route: { routeFrom: string; routeTo: string }
): boolean {
  const from = locationExpression(route.routeFrom);
  const to = locationExpression(route.routeTo);
  const patterns = [
    new RegExp(`\\btu\\s+${from}\\s+(?:den|toi|di|ra|vao|ve)\\s+${to}\\b`, "u"),
    new RegExp(`\\b${from}\\s+(?:den|toi|di|ra|vao|ve)\\s+${to}\\b`, "u"),
    new RegExp(`\\b(?:di|den|toi|ra|vao|ve)\\s+${to}\\s+tu\\s+${from}\\b`, "u")
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function extractRoute(normalized: string, departures: readonly DepartureCandidate[]) {
  const uniqueRoutes = new Map<string, { routeFrom: string; routeTo: string }>();
  for (const departure of departures) {
    uniqueRoutes.set(`${departure.routeFrom}\u0000${departure.routeTo}`, departure);
  }
  const explicitMatches = [...uniqueRoutes.values()]
    .map((route) => ({
      ...route,
      specificity:
        normalizeForSearch(route.routeFrom).length + normalizeForSearch(route.routeTo).length
    }))
    .filter((route) => routePatternMatches(normalized, route))
    .sort((left, right) => right.specificity - left.specificity);
  if (explicitMatches.length > 0) {
    const route = explicitMatches[0];
    if (route === undefined) return {};
    return { routeFrom: route.routeFrom, routeTo: route.routeTo };
  }
  const orderedMatches = [...uniqueRoutes.values()]
    .map((route) => {
      const from = findSpokenLocation(normalized, route.routeFrom);
      const to = from === null ? null : findSpokenLocation(normalized, route.routeTo, from.end);
      return {
        ...route,
        fromIndex: from?.index ?? -1,
        toIndex: to?.index ?? -1,
        specificity:
          normalizeForSearch(route.routeFrom).length + normalizeForSearch(route.routeTo).length
      };
    })
    .filter((route) => route.fromIndex >= 0 && route.toIndex > route.fromIndex)
    .sort((left, right) => right.specificity - left.specificity);
  const route = orderedMatches[0];
  return route === undefined ? {} : { routeFrom: route.routeFrom, routeTo: route.routeTo };
}

function extractDepartureHints(normalized: string) {
  const numericTime = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/u);
  const spokenColonTime = normalized.match(
    new RegExp(`\\b(${NUMBER_EXPRESSION})\\s*:\\s*(${NUMBER_EXPRESSION})(?:\\s*phut)?\\b`, "u")
  );
  const timeMatch = normalized.match(
    new RegExp(
      `\\b(${NUMBER_EXPRESSION})\\s*(?:gio|h)\\b(?:\\s+(${NUMBER_EXPRESSION})\\s*(?:phut)?)?`,
      "u"
    )
  );
  const hour =
    numericTime === null
      ? parseNumber(spokenColonTime?.[1] ?? timeMatch?.[1])
      : Number(numericTime[1]);
  const minute =
    numericTime === null
      ? (parseNumber(spokenColonTime?.[2] ?? timeMatch?.[2]) ?? 0)
      : Number(numericTime[2]);
  const wordDate = normalized.match(
    new RegExp(`\\bngay\\s+(${NUMBER_EXPRESSION})\\s+thang\\s+(${NUMBER_EXPRESSION})\\b`, "u")
  );
  const numericDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})\b/u);
  const day = parseNumber(wordDate?.[1] ?? numericDate?.[1]);
  const month = parseNumber(wordDate?.[2] ?? numericDate?.[2]);
  return {
    ...(hour !== undefined && hour <= 23 && minute <= 59
      ? {
          departureLocalTime: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        }
      : {}),
    ...(day !== undefined && day >= 1 && day <= 31 ? { departureDay: day } : {}),
    ...(month !== undefined && month >= 1 && month <= 12 ? { departureMonth: month } : {})
  };
}

function extractSpokenPhone(normalized: string): string | undefined {
  const tokens = normalized.split(/\s+/u);
  const marker = tokens.findIndex((token, index) => {
    if (token === "sdt") return true;
    return (
      (token === "so" && tokens[index + 1] === "dien" && tokens[index + 2] === "thoai") ||
      (token === "lien" && tokens[index + 1] === "he")
    );
  });
  if (marker < 0) return undefined;
  const firstDigitIndex =
    tokens[marker] === "sdt" ? marker + 1 : tokens[marker] === "lien" ? marker + 2 : marker + 3;
  const digits: string[] = [];
  const phoneTokens = tokens.slice(firstDigitIndex).map((token, offset) => {
    const compact = token.replace(/[^\p{L}\p{N}]/gu, "");
    return offset === 0 && compact.startsWith("la") ? compact.slice(2) : compact;
  });
  for (let index = 0; index < phoneTokens.length; index += 1) {
    const token = phoneTokens[index] ?? "";
    const hundredDigit = NUMBER_UNITS[token];
    const unitAfterHundred = NUMBER_UNITS[phoneTokens[index + 3] ?? ""];
    if (
      hundredDigit !== undefined &&
      phoneTokens[index + 1] === "tram" &&
      phoneTokens[index + 2] === "le" &&
      unitAfterHundred !== undefined
    ) {
      digits.push(String(hundredDigit), "0", String(unitAfterHundred));
      index += 3;
      continue;
    }
    let remaining = token;
    while (remaining.length > 0) {
      const word = PHONE_DIGIT_WORDS.find((candidate) => remaining.startsWith(candidate));
      if (word === undefined) break;
      digits.push(String(NUMBER_UNITS[word]));
      remaining = remaining.slice(word.length);
      if (digits.length > 11) return undefined;
    }
    if (remaining.length > 0) break;
  }
  const normalizedDigits = digits.join("");
  const phone =
    normalizedDigits.length === 9 && !normalizedDigits.startsWith("0")
      ? `0${normalizedDigits}`
      : normalizedDigits;
  return /^0\d{8,10}$/u.test(phone) ? phone : undefined;
}

function supportedPickupPoints(departures: readonly DepartureCandidate[]): string[] {
  const points = new Set(["My Dinh", "Ben xe Trung tam Da Nang"]);
  for (const departure of departures) {
    for (const point of departure.pickupPoints ?? []) points.add(point);
    points.add(`Ben xe ${departure.routeFrom}`);
    points.add(`Ben xe trung tam ${departure.routeFrom}`);
  }
  return [...points];
}

function pickupExpression(point: string) {
  const normalized = normalizeForSearch(point).trim();
  if (normalized.startsWith("ben xe ")) {
    return `(?:ben|bay)\\s*xe\\s*${locationExpression(normalized.slice("ben xe ".length))}`;
  }
  return locationExpression(point);
}

function extractSupportedPickupPoint(
  normalized: string,
  pickupPoints: readonly string[]
): string | undefined {
  const ordered = [...new Set(pickupPoints)].sort(
    (left, right) => normalizeForSearch(right).length - normalizeForSearch(left).length
  );
  return ordered.find((point) =>
    new RegExp(`\\b${pickupExpression(point)}\\b`, "u").test(normalized)
  );
}

function extractPassengerCount(normalized: string): number | undefined {
  const passengerUnit = "(?:ve|khach|nguoi|cho)";
  const replacement = normalized.match(
    new RegExp(
      `\\b(?:thanh|doi\\s+(?:sang|qua)|sua(?:\\s+lai)?\\s+thanh)\\s+(${NUMBER_EXPRESSION})\\s*${passengerUnit}\\b`,
      "u"
    )
  );
  if (replacement?.[1] !== undefined) return parseNumber(replacement[1]);
  const firstMentionPattern = new RegExp(`\\b(${NUMBER_EXPRESSION})\\s*${passengerUnit}\\b`, "gu");
  for (const match of normalized.matchAll(firstMentionPattern)) {
    const previous = normalized[Math.max(0, (match.index ?? 0) - 1)];
    if (previous === ":") continue;
    return parseNumber(match[1]);
  }
  return undefined;
}

export function extractReplayFacts(
  content: string,
  options: ExtractionOptions = {}
): ExtractedFacts {
  const normalized = normalizeForSearch(content).replace(/\s+/gu, " ").trim();
  const phone = content.match(/\b0\d{8,10}\b/u)?.[0] ?? extractSpokenPhone(normalized);
  const passengerCount = extractPassengerCount(normalized);
  const departures = (options.departures ?? []).filter(
    (departure) => departure.departureAtUtc > (options.now ?? new Date())
  );
  const pickupPoint = extractSupportedPickupPoint(normalized, supportedPickupPoints(departures));

  return {
    ...extractRoute(normalized, departures),
    ...extractDepartureHints(normalized),
    ...(passengerCount !== undefined && passengerCount >= 1 && passengerCount <= 36
      ? { passengerCount }
      : {}),
    ...(pickupPoint === undefined ? {} : { pickupPoint }),
    ...(phone !== undefined ? { contactPhoneMasked: maskPhone(phone) } : {})
  };
}
