import { transitionReceipt } from "@call-to-cash/domain";
import type { DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  EventName,
  ProofStatus,
  ReceiptStatus,
  RiskNextAction,
  type EnumValue
} from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import {
  iso,
  requireTransition,
  sha256,
  transitionBookingThrough,
  type ServiceData
} from "../types.js";

type ReceiptStatusValue = EnumValue<typeof ReceiptStatus>;

export async function verifyReceiptTamper(
  client: DatabaseClient,
  receiptId: string,
  candidateDepositAmountMinor: number,
  requestId: string
): Promise<ServiceData> {
  const now = new Date();
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
    let status = receiptProof.verificationStatus;
    const candidate = JSON.parse(JSON.stringify(receiptAgreement.canonicalPayload)) as {
      commercialTerms?: { depositAmountVnd?: number };
    };
    if (candidate.commercialTerms !== undefined) {
      candidate.commercialTerms.depositAmountVnd = candidateDepositAmountMinor;
    }
    if (sha256(JSON.stringify(candidate)) !== receiptProof.proofHashSha256) {
      status = ProofStatus.Mismatch;
      await transaction.proofRecord.update({
        where: { id: receiptProof.id },
        data: { verificationStatus: "MISMATCH", verifiedAt: now }
      });
      await transaction.trustReceipt.update({
        where: { id: receipt.id },
        data: {
          status: requireTransition(
            transitionReceipt(receipt.status as ReceiptStatusValue, ReceiptStatus.Mismatch),
            "Receipt cannot enter mismatch from its current state."
          ),
          verifiedAt: now
        }
      });
      const currentBooking = await transaction.booking.findUniqueOrThrow({
        where: { id: receipt.bookingId },
        select: { status: true }
      });
      await transitionBookingThrough(transaction, receipt.bookingId, currentBooking.status, [
        BookingStatus.ManualReviewRequired
      ]);
      const call = await transaction.callSession.findFirstOrThrow({
        where: { bookingId: receipt.bookingId }
      });
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId: receiptBooking.publicId,
        event: EventName.ReceiptVerified,
        data: {
          receiptId: receipt.publicId,
          status: ReceiptStatus.Mismatch,
          verification: ProofStatus.Mismatch,
          agreementVersion: receiptAgreement.version,
          verifiedAt: iso(now),
          customerMessage: "Receipt proof requires manual review.",
          nextAction: RiskNextAction.ManualReview
        },
        requestId,
        occurredAt: now
      });
    }
    return {
      bookingId: receiptBooking.publicId,
      receiptId: receipt.publicId,
      status,
      agreementVersion: receiptAgreement.version,
      proofHash: receiptProof.proofHashSha256,
      verifiedAt: receiptProof.verifiedAt === null ? null : iso(receiptProof.verifiedAt),
      ...(status === ProofStatus.Mismatch ? { nextAction: RiskNextAction.ManualReview } : {})
    };
  });
}
