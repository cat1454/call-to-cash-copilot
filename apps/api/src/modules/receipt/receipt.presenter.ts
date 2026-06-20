import { Currency } from "@call-to-cash/shared";

import { iso, shortSignature, type ServiceData } from "./types.js";

type ReceiptReadModel = {
  publicId: string;
  status: string;
  issuedAt: Date;
  booking: {
    publicId: string;
    routeFrom: string | null;
    routeTo: string | null;
    departureAtUtc: Date | null;
    passengerCount: number | null;
    contactPhoneMasked: string | null;
  };
  paymentIntent: {
    amountMinor: number;
    status: string;
    transactions: Array<{ txSignature: string }>;
  };
  proofRecord: {
    verificationStatus: string;
    agreement: { version: number };
  } | null;
};

export function presentReceipt(receipt: ReceiptReadModel): ServiceData {
  if (receipt.proofRecord === null) {
    throw new Error("Receipt projection requires a proof record.");
  }
  const transaction = receipt.paymentIntent.transactions[0];
  return {
    receiptId: receipt.publicId,
    bookingId: receipt.booking.publicId,
    status: receipt.status,
    booking: {
      bookingId: receipt.booking.publicId,
      route: `${receipt.booking.routeFrom} â†’ ${receipt.booking.routeTo}`,
      departureAt:
        receipt.booking.departureAtUtc === null
          ? iso(receipt.issuedAt)
          : iso(receipt.booking.departureAtUtc),
      passengerCount: receipt.booking.passengerCount ?? 1,
      contactPhoneMasked: receipt.booking.contactPhoneMasked ?? "[PHONE]"
    },
    deposit: {
      amount: { currency: Currency.Vnd, minor: receipt.paymentIntent.amountMinor },
      status: receipt.paymentIntent.status
    },
    verification: {
      status: receipt.proofRecord.verificationStatus,
      agreementVersion: receipt.proofRecord.agreement.version,
      transactionSignatureShort:
        transaction === undefined ? "mock" : shortSignature(transaction.txSignature)
    }
  };
}
