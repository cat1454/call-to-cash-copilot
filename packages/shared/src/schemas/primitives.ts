import { z } from "zod";

import { Currency } from "../enums/index.js";

const createPublicIdSchema = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{5,127}$`), {
    message: `Expected a public ${prefix}_ identifier.`
  });

export const CallIdSchema = createPublicIdSchema("call");
export const BookingIdSchema = createPublicIdSchema("bk");
export const AgreementIdSchema = createPublicIdSchema("agr");
export const PaymentIntentIdSchema = createPublicIdSchema("pi");
export const ReceiptIdSchema = createPublicIdSchema("rcpt");
export const EventIdSchema = createPublicIdSchema("evt");
export const UserIdSchema = createPublicIdSchema("usr");
export const TranscriptTurnIdSchema = createPublicIdSchema("turn");
export const RiskAssessmentIdSchema = createPublicIdSchema("risk");
export const ExtractionIdSchema = createPublicIdSchema("ext");
export const ProofIdSchema = createPublicIdSchema("proof");
export const RequestIdSchema = z.string().min(1).max(128);
export const JobIdSchema = createPublicIdSchema("job");
export const InventoryReservationIdSchema = createPublicIdSchema("hold");

export const IsoTimestampSchema = z
  .string()
  .refine(
    (value) => /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && !Number.isNaN(Date.parse(value)),
    "Expected an ISO-8601 timestamp with a timezone offset."
  );

export const PositiveIntegerSchema = z.number().int().positive();
export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const ScoreSchema = z.number().int().min(0).max(100);
export const CurrencySchema = z.enum(Currency);
export const MoneySchema = z
  .object({
    currency: CurrencySchema,
    minor: NonNegativeIntegerSchema
  })
  .strict();
export const Sha256HashSchema = z.string().regex(/^[a-f0-9]{64}$/u, {
  message: "Expected a lowercase SHA-256 hash."
});
export const MaskedContactSchema = z.string().min(1);
export const OpaqueReferenceSchema = z.string().min(1);

export type CallId = z.infer<typeof CallIdSchema>;
export type BookingId = z.infer<typeof BookingIdSchema>;
export type AgreementId = z.infer<typeof AgreementIdSchema>;
export type PaymentIntentId = z.infer<typeof PaymentIntentIdSchema>;
export type ReceiptId = z.infer<typeof ReceiptIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
