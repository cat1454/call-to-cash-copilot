import type { Agreement } from "@call-to-cash/shared";

type CanonicalValue =
  | boolean
  | number
  | string
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function normalizeString(value: string): string {
  return value.trim().normalize("NFC");
}

function normalizeTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("Agreement timestamps must be valid ISO-8601 values.");
  }

  return new Date(timestamp).toISOString();
}

function stableStringify(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] as CanonicalValue)}`)
    .join(",")}}`;
}

export function serializeCanonicalAgreement(agreement: Agreement): string {
  const canonicalPayload: CanonicalValue = {
    agreementVersion: agreement.version,
    bookingId: normalizeString(agreement.bookingId),
    canonicalizationVersion: agreement.canonicalizationVersion,
    commercialTerms: {
      currency: agreement.commercialTerms.currency,
      depositAmountVnd: agreement.commercialTerms.depositAmountVnd,
      fareTotalVnd: agreement.commercialTerms.fareTotalVnd,
      refundPolicySummary: normalizeString(agreement.commercialTerms.refundPolicySummary),
      refundPolicyVersion: normalizeString(agreement.commercialTerms.refundPolicyVersion)
    },
    service: {
      departureAt: normalizeTimestamp(agreement.service.departureAt),
      holdExpiresAt: normalizeTimestamp(agreement.service.holdExpiresAt),
      inventoryReservationId: normalizeString(agreement.service.inventoryReservationId),
      passengerCount: agreement.service.passengerCount,
      pickupPoint: normalizeString(agreement.service.pickupPoint),
      routeFrom: normalizeString(agreement.service.routeFrom),
      routeTo: normalizeString(agreement.service.routeTo)
    }
  };

  return stableStringify(canonicalPayload);
}
