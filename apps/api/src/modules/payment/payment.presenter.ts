import { Currency, PaymentIntentStatus, RiskNextAction } from "@call-to-cash/shared";
import type { ProviderPaymentIntent } from "@call-to-cash/solana";

import type { PaymentIntentCreateResult, ServiceData } from "./types.js";
import { iso } from "./types.js";

export function presentPaymentIntent(input: {
  statusCode: number;
  bookingId: string;
  agreementId: string;
  intent: {
    publicId: string;
    amountMinor: number;
    recipientWallet: string;
    solanaReference: string;
    expiresAt: Date;
    idempotencyKey: string;
  };
  providerIntent: ProviderPaymentIntent;
}): PaymentIntentCreateResult {
  const providerPayment =
    input.providerIntent.provider === "solana_devnet"
      ? {
          provider: "solana_devnet",
          cluster: "devnet",
          amountLamports: input.providerIntent.paymentAmount.minor,
          amountSol: input.providerIntent.paymentAmount.display,
          solanaPayUrl: input.providerIntent.solanaPayUrl,
          qrPayload: input.providerIntent.qrPayload,
          memo: input.providerIntent.memo
        }
      : {
          provider: "mock",
          mode: "deterministic_mock",
          amountMinor: input.providerIntent.paymentAmount.minor
        };
  return {
    statusCode: input.statusCode,
    data: {
      paymentIntentId: input.intent.publicId,
      bookingId: input.bookingId,
      agreementId: input.agreementId,
      status: PaymentIntentStatus.Created,
      amount: { currency: Currency.Vnd, minor: input.intent.amountMinor },
      recipient: input.intent.recipientWallet,
      reference: input.intent.solanaReference,
      expiresAt: iso(input.intent.expiresAt),
      idempotencyKey: input.intent.idempotencyKey,
      provider: input.providerIntent.provider,
      providerPayment
    }
  };
}

export function presentPaymentStatus(input: {
  bookingId: string;
  paymentIntentId: string;
  status: string;
  transactionSignature?: string | null;
  verifiedAt?: Date | null;
}): ServiceData {
  return {
    bookingId: input.bookingId,
    paymentIntentId: input.paymentIntentId,
    status: input.status,
    transactionSignature: input.transactionSignature ?? null,
    verifiedAt:
      input.verifiedAt === null || input.verifiedAt === undefined ? null : iso(input.verifiedAt),
    nextAction:
      input.status === PaymentIntentStatus.Confirmed
        ? RiskNextAction.IssueReceipt
        : RiskNextAction.Hold
  };
}
