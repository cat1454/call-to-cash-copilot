import {
  BookingField,
  BookingStatus,
  FieldProvenanceSource,
  FieldProvenanceStatus,
  type BookingDraft,
  type BookingExtraction,
  type RiskReasonCode
} from "@call-to-cash/shared";

import { isInventoryHoldActive } from "../inventory/index.js";

export interface BookingValidationInput {
  booking: BookingDraft;
  inventoryHoldActive: boolean;
  now: string | Date;
}

export interface BookingValidationResult {
  isValid: boolean;
  missingFields: (typeof BookingField)[keyof typeof BookingField][];
  reasonCodes: RiskReasonCode[];
}

export type MaterialBookingField =
  | "routeFrom"
  | "routeTo"
  | "departureAt"
  | "passengerCount"
  | "pickupPoint"
  | "inventoryReservationId"
  | "fareTotalVnd"
  | "depositAmountVnd"
  | "refundPolicyVersion";

export type BookingMaterialPatch = Partial<{
  [K in MaterialBookingField]: K extends "passengerCount" | "fareTotalVnd" | "depositAmountVnd"
    ? number
    : string;
}>;

export interface MaterialChangeResult {
  booking: BookingDraft;
  changedFields: MaterialBookingField[];
}

export interface AppliedBookingExtraction {
  booking: BookingDraft;
  changedFields: MaterialBookingField[];
}

function appendMissing(
  missingFields: BookingValidationResult["missingFields"],
  reasonCodes: RiskReasonCode[],
  field: (typeof BookingField)[keyof typeof BookingField],
  reason: RiskReasonCode
): void {
  missingFields.push(field);
  if (!reasonCodes.includes(reason)) {
    reasonCodes.push(reason);
  }
}

function hasTrimmedValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function isFutureIsoTimestamp(value: string | undefined, now: string | Date): boolean {
  if (value === undefined) {
    return false;
  }

  const timestamp = Date.parse(value);
  const currentTime = typeof now === "string" ? Date.parse(now) : now.getTime();
  return Number.isFinite(timestamp) && Number.isFinite(currentTime) && timestamp > currentTime;
}

export function validateBookingFields(input: BookingValidationInput): BookingValidationResult {
  const { booking } = input;
  const missingFields: BookingValidationResult["missingFields"] = [];
  const reasonCodes: RiskReasonCode[] = [];

  if (!hasTrimmedValue(booking.service.routeFrom)) {
    appendMissing(missingFields, reasonCodes, BookingField.RouteFrom, "MISSING_ROUTE");
  }
  if (!hasTrimmedValue(booking.service.routeTo)) {
    appendMissing(missingFields, reasonCodes, BookingField.RouteTo, "MISSING_ROUTE");
  }
  if (!isFutureIsoTimestamp(booking.service.departureAt, input.now)) {
    appendMissing(missingFields, reasonCodes, BookingField.DepartureAt, "MISSING_DEPARTURE_TIME");
  }
  if (booking.service.passengerCount === undefined || booking.service.passengerCount < 1) {
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.PassengerCount,
      "MISSING_PASSENGER_COUNT"
    );
  }
  if (!hasTrimmedValue(booking.service.pickupPoint)) {
    appendMissing(missingFields, reasonCodes, BookingField.PickupPoint, "MISSING_PICKUP_POINT");
  }
  if (!hasTrimmedValue(booking.customer.contactMasked)) {
    appendMissing(missingFields, reasonCodes, BookingField.ContactPhone, "MISSING_CONTACT");
  }
  if (booking.pricing.fareTotalVnd === undefined) {
    appendMissing(missingFields, reasonCodes, BookingField.FareTotalVnd, "MISSING_PRICE");
  }
  if (
    booking.pricing.depositAmountVnd === undefined ||
    booking.pricing.depositAmountVnd <= 0 ||
    (booking.pricing.fareTotalVnd !== undefined &&
      booking.pricing.depositAmountVnd > booking.pricing.fareTotalVnd)
  ) {
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.DepositAmountVnd,
      "MISSING_DEPOSIT_AMOUNT"
    );
  }
  if (!hasTrimmedValue(booking.pricing.refundPolicyVersion)) {
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.RefundPolicyVersion,
      "MISSING_REFUND_POLICY"
    );
  }
  if (!booking.confirmations.refundPolicyConfirmed) {
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.RefundPolicyConfirmation,
      "REFUND_POLICY_NOT_CONFIRMED"
    );
  }
  if (!booking.service.inventoryReservationId) {
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.InventoryReservation,
      "INVENTORY_UNAVAILABLE"
    );
  } else if (
    !isInventoryHoldActive(
      input.inventoryHoldActive,
      booking.service.inventoryHoldExpiresAt,
      input.now
    )
  ) {
    const currentTime = typeof input.now === "string" ? Date.parse(input.now) : input.now.getTime();
    const expiresAt = booking.service.inventoryHoldExpiresAt
      ? Date.parse(booking.service.inventoryHoldExpiresAt)
      : Number.NaN;
    appendMissing(
      missingFields,
      reasonCodes,
      BookingField.InventoryReservation,
      Number.isFinite(expiresAt) && expiresAt <= currentTime
        ? "INVENTORY_HOLD_EXPIRED"
        : "INVENTORY_UNAVAILABLE"
    );
  }

  return { isValid: missingFields.length === 0, missingFields, reasonCodes };
}

export function invalidateConfirmationOnMaterialChange(
  booking: BookingDraft,
  changedFields: readonly MaterialBookingField[]
): BookingDraft {
  if (changedFields.length === 0) {
    return booking;
  }

  const agreementReadyOrigins: (typeof BookingStatus)[keyof typeof BookingStatus][] = [
    BookingStatus.BookingDraftReady,
    BookingStatus.AgreementReady,
    BookingStatus.AgreementLocked,
    BookingStatus.PaymentPending
  ];
  const canReturnToAgreementReady = agreementReadyOrigins.includes(booking.status);
  const confirmations = { ...booking.confirmations };
  delete confirmations.explicitConfirmationForAgreementVersion;

  return {
    ...booking,
    status: canReturnToAgreementReady ? BookingStatus.AgreementReady : booking.status,
    confirmations: {
      ...confirmations,
      explicitConfirmation: false
    },
    updatedAt: booking.updatedAt
  };
}

export function applyMaterialChange(
  booking: BookingDraft,
  patch: BookingMaterialPatch
): MaterialChangeResult {
  const service = { ...booking.service };
  const pricing = { ...booking.pricing };
  const changedFields: MaterialBookingField[] = [];

  const applyServiceField = <K extends keyof typeof service>(
    field: K,
    value: (typeof service)[K] | undefined
  ): void => {
    if (value !== undefined && value !== service[field]) {
      service[field] = value;
      changedFields.push(field as MaterialBookingField);
    }
  };
  const applyPricingField = <K extends keyof typeof pricing>(
    field: K,
    value: (typeof pricing)[K] | undefined
  ): void => {
    if (value !== undefined && value !== pricing[field]) {
      pricing[field] = value;
      changedFields.push(field as MaterialBookingField);
    }
  };

  applyServiceField("routeFrom", patch.routeFrom);
  applyServiceField("routeTo", patch.routeTo);
  applyServiceField("departureAt", patch.departureAt);
  applyServiceField("passengerCount", patch.passengerCount);
  applyServiceField("pickupPoint", patch.pickupPoint);
  applyServiceField("inventoryReservationId", patch.inventoryReservationId);
  applyPricingField("fareTotalVnd", patch.fareTotalVnd);
  applyPricingField("depositAmountVnd", patch.depositAmountVnd);
  applyPricingField("refundPolicyVersion", patch.refundPolicyVersion);

  const changedBooking = { ...booking, service, pricing };
  return {
    booking: invalidateConfirmationOnMaterialChange(changedBooking, changedFields),
    changedFields
  };
}

export function applyBookingExtraction(
  booking: BookingDraft,
  extraction: BookingExtraction
): AppliedBookingExtraction {
  if (extraction.status !== "ACCEPTED") {
    return { booking, changedFields: [] };
  }

  const patch: BookingMaterialPatch = {};
  if (extraction.extractedFields.routeFrom !== undefined) {
    patch.routeFrom = extraction.extractedFields.routeFrom;
  }
  if (extraction.extractedFields.routeTo !== undefined) {
    patch.routeTo = extraction.extractedFields.routeTo;
  }
  if (extraction.extractedFields.departureAt !== undefined) {
    patch.departureAt = extraction.extractedFields.departureAt;
  }
  if (extraction.extractedFields.passengerCount !== undefined) {
    patch.passengerCount = extraction.extractedFields.passengerCount;
  }
  if (extraction.extractedFields.pickupPoint !== undefined) {
    patch.pickupPoint = extraction.extractedFields.pickupPoint;
  }
  const materialChange = applyMaterialChange(booking, patch);
  const provenance = { ...materialChange.booking.provenance };

  const proposedFields: Array<[string, number | undefined]> = [
    ["routeFrom", extraction.fieldConfidence.routeFrom],
    ["routeTo", extraction.fieldConfidence.routeTo],
    ["departureAt", extraction.fieldConfidence.departureAt],
    ["passengerCount", extraction.fieldConfidence.passengerCount],
    ["pickupPoint", extraction.fieldConfidence.pickupPoint]
  ];

  for (const [field, confidence] of proposedFields) {
    if (field in extraction.extractedFields) {
      provenance[field] = {
        source: FieldProvenanceSource.CustomerVoice,
        status: FieldProvenanceStatus.Proposed,
        ...(confidence === undefined ? {} : { confidence })
      };
    }
  }

  if (extraction.extractedFields.contact !== undefined) {
    provenance.contactPhone = {
      source: FieldProvenanceSource.CustomerVoice,
      status: FieldProvenanceStatus.Proposed,
      ...(extraction.fieldConfidence.contact === undefined
        ? {}
        : { confidence: extraction.fieldConfidence.contact })
    };
  }

  return {
    booking: { ...materialChange.booking, provenance },
    changedFields: materialChange.changedFields
  };
}
