import { transitionReceipt } from "@call-to-cash/domain";
import { ReceiptStatus } from "@call-to-cash/shared";

import type { Transaction } from "../types.js";
import { asJson, opaqueId, requireTransition } from "../types.js";

export async function createVerifiedTrustReceipt(
  transaction: Transaction,
  input: {
    bookingId: string;
    paymentIntentId: string;
    proofRecordId: string;
    receiptPayload: {
      bookingId: string;
      route: string;
      contactPhoneMasked: string | null;
      deposit: number;
      agreementVersion: number;
    };
    now: Date;
  }
): Promise<{ id: string; publicId: string }> {
  const receipt = await transaction.trustReceipt.create({
    data: {
      publicId: opaqueId("rcpt"),
      bookingId: input.bookingId,
      paymentIntentId: input.paymentIntentId,
      proofRecordId: input.proofRecordId,
      status: ReceiptStatus.Issued,
      receiptPayload: asJson(input.receiptPayload),
      issuedAt: input.now,
      verifiedAt: input.now
    }
  });
  const verifiedReceiptStatus = requireTransition(
    transitionReceipt(ReceiptStatus.Issued, ReceiptStatus.VerifiedMatch),
    "Receipt cannot be verified from its current state."
  );
  await transaction.trustReceipt.update({
    where: { id: receipt.id },
    data: { status: verifiedReceiptStatus }
  });

  return receipt;
}
