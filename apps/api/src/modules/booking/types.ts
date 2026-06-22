import type { Prisma } from "@call-to-cash/db";
import type { EnumValue } from "@call-to-cash/shared";
import type { BookingStatus } from "@call-to-cash/shared";

export type Transaction = Prisma.TransactionClient;
export type ServiceData = Record<string, unknown>;
export type BookingStatusValue = EnumValue<typeof BookingStatus>;

export type ExtractedFacts = {
  routeFrom?: string;
  routeTo?: string;
  passengerCount?: number;
  pickupPoint?: string;
  contactPhoneMasked?: string;
  departureLocalTime?: string;
  departureDay?: number;
  departureMonth?: number;
};

export type BookingForRisk = {
  id: string;
  publicId: string;
  status: string;
  routeFrom: string | null;
  routeTo: string | null;
  departureAtUtc: Date | null;
  departureTimezone: string;
  passengerCount: number | null;
  pickupPointDisplay: string | null;
  contactPhoneMasked: string | null;
  totalAmountMinor: number | null;
  depositAmountMinor: number | null;
  refundPolicyVersion: string | null;
  inventoryHolds: Array<{
    id: string;
    publicId: string;
    status: string;
    quantity: number;
    expiresAt: Date;
  }>;
  agreements: Array<{
    id: string;
    publicId: string;
    version: number;
    status: string;
    payloadHashSha256: string;
  }>;
  paymentIntents: Array<{ publicId: string; status: string }>;
};

export type UpsertBookingFromFactsInput = {
  callSessionId: string;
  facts: ExtractedFacts;
  requestId: string;
  now: Date;
};

export type BookingDraftWriter = {
  upsertFromFacts(
    transaction: Transaction,
    input: UpsertBookingFromFactsInput
  ): Promise<{
    id: string;
    publicId: string;
    status: string;
    created: boolean;
    changedFields: string[];
  }>;
};
