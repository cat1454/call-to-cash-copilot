import { Currency, PaymentIntentStatus, RiskNextAction } from "@call-to-cash/shared";

import type { MockPaymentCreateResult, ServiceData } from "./types.js";
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
}): MockPaymentCreateResult {
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
      idempotencyKey: input.intent.idempotencyKey
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
