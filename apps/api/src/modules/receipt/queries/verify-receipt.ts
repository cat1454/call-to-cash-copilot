import type { DatabaseClient } from "@call-to-cash/db";
import { ProofStatus, RiskNextAction } from "@call-to-cash/shared";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { iso, type ServiceData } from "../types.js";

export async function verifyReceipt(
  client: DatabaseClient,
  receiptId: string
): Promise<ServiceData> {
  return client.$transaction(async (transaction) => {
    const receipt = await transaction.trustReceipt.findUnique({ where: { publicId: receiptId } });
    if (receipt === null || receipt.proofRecordId === null) {
      throw new ApiCommandError(404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
    }
    const receiptBooking = await transaction.booking.findUniqueOrThrow({
      where: { id: receipt.bookingId },
      select: { publicId: true }
    });
    const receiptProof = await transaction.proofRecord.findUniqueOrThrow({
      where: { id: receipt.proofRecordId }
    });
    const receiptAgreement = await transaction.agreement.findUniqueOrThrow({
      where: { id: receiptProof.agreementId }
    });

    return {
      bookingId: receiptBooking.publicId,
      receiptId: receipt.publicId,
      status: receiptProof.verificationStatus,
      agreementVersion: receiptAgreement.version,
      proofHash: receiptProof.proofHashSha256,
      verifiedAt: receiptProof.verifiedAt === null ? null : iso(receiptProof.verifiedAt),
      ...(receiptProof.verificationStatus === ProofStatus.Mismatch
        ? { nextAction: RiskNextAction.ManualReview }
        : {})
    };
  });
}
