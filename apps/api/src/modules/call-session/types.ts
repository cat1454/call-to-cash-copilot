import type { Prisma, DatabaseClient } from "@call-to-cash/db";
import type {
  EnumValue,
  CallSourceMode,
  TranscriptSource,
  TranscriptSpeaker
} from "@call-to-cash/shared";

export type Transaction = Prisma.TransactionClient;

export type ServiceData = Record<string, unknown>;

export type CallSessionDependencies = {
  databaseClient?: DatabaseClient;
};

export type CreateCallSessionInput = {
  sourceMode: (typeof CallSourceMode)[keyof typeof CallSourceMode];
  customerId?: string;
  operatorId?: string;
  analysisEnabled?: boolean;
  requestId: string;
};

export type EndCallSessionInput = {
  callId: string;
  reason: string;
  requestId: string;
};

export type AppendTranscriptTurnInput = {
  callId: string;
  turn: {
    clientTurnId: string;
    provider?: string | undefined;
    providerTurnId?: string | undefined;
    sequenceNo: number;
    speaker: (typeof TranscriptSpeaker)[keyof typeof TranscriptSpeaker];
    content: string;
    language: string;
    isFinal: boolean;
    startedAt?: string | undefined;
    endedAt?: string | undefined;
    sttConfidence?: number | undefined;
    source: (typeof TranscriptSource)[keyof typeof TranscriptSource];
  };
  requestId: string;
};

export type CallStatusValue = EnumValue<typeof import("@call-to-cash/shared").CallStatus>;
export type BookingStatusValue = EnumValue<typeof import("@call-to-cash/shared").BookingStatus>;

export type ExtractedFacts = {
  routeFrom?: string;
  routeTo?: string;
  passengerCount?: number;
  pickupPoint?: string;
  contactPhoneMasked?: string;
  departureHint?: "22:30";
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
  paymentIntents: Array<{
    publicId: string;
    status: string;
  }>;
};
