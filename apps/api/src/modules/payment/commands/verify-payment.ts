import { transitionPaymentIntent } from "@call-to-cash/domain";
import type { DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  EventName,
  PaymentIntentStatus,
  ProofStatus,
  RiskNextAction,
  type ErrorCode,
  type VerifyMockPaymentRequest
} from "@call-to-cash/shared";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { validateMockPaymentObservation } from "../../../platform/providers/mock-payment-provider.js";
import { createVerifiedProofRecord } from "../proof/create-proof-record.js";
import { createVerifiedTrustReceipt } from "../proof/create-trust-receipt.js";
import type { ServiceData, Transaction } from "../types.js";
import {
  asJson,
  iso,
  opaqueId,
  requireTransition,
  sha256,
  shortSignature,
  transitionBookingThrough
} from "../types.js";

type PaymentVerificationResult =
  | { data: ServiceData }
  | { error: { statusCode: number; code: ErrorCode; message: string } };

export async function verifyPayment(
  transaction: Transaction,
  input: VerifyMockPaymentRequest,
  idempotencyKey: string,
  requestId: string,
  now: Date
): Promise<PaymentVerificationResult> {
  const idempotencyKeyHash = sha256(idempotencyKey);
  const requestFingerprint = sha256(
    JSON.stringify({
      paymentIntentId: input.paymentIntentId,
      observedAmount: input.observedAmount,
      observedRecipient: input.observedRecipient,
      observedReference: input.observedReference,
      transactionSignature: input.transactionSignature ?? null
    })
  );
  const replay = await transaction.paymentTransaction.findFirst({
    where: { rawChainMetadata: { path: ["idempotencyKeyHash"], equals: idempotencyKeyHash } }
  });
  if (replay !== null) {
    const replayIntent = await transaction.paymentIntent.findUniqueOrThrow({
      where: { id: replay.paymentIntentId }
    });
    const replayBooking = await transaction.booking.findUniqueOrThrow({
      where: { id: replayIntent.bookingId },
      select: { publicId: true }
    });
    const replayReceipt = await transaction.trustReceipt.findUnique({
      where: { paymentIntentId: replayIntent.id }
    });
    const replayProof = await transaction.proofRecord.findUnique({
      where: { paymentTransactionId: replay.id }
    });
    const replayMetadata = replay.rawChainMetadata as { requestFingerprint?: string } | null;
    if (
      replayIntent.publicId !== input.paymentIntentId ||
      replayMetadata?.requestFingerprint !== requestFingerprint
    ) {
      throw new ApiCommandError(
        409,
        "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
        "Idempotency key was already used with another verification payload."
      );
    }
    if (
      replay.verificationStatus === "CONFIRMED" &&
      replayReceipt !== null &&
      replayProof !== null
    ) {
      return {
        data: {
          paymentIntentId: replayIntent.publicId,
          bookingId: replayBooking.publicId,
          status: PaymentIntentStatus.Confirmed,
          transactionSignature: replay.txSignature,
          proofId: replayProof.publicId,
          receiptId: replayReceipt.publicId
        }
      };
    }
    if (replay.verificationStatus === "REJECTED") {
      return {
        error: {
          statusCode: 422,
          code: (replay.rejectionReasonCode ?? "PAYMENT_VERIFICATION_FAILED") as ErrorCode,
          message: "Payment verification failed closed."
        }
      };
    }
  }

  const intent = await transaction.paymentIntent.findUnique({
    where: { publicId: input.paymentIntentId }
  });
  if (intent === null) {
    throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
  }
  const intentBooking = await transaction.booking.findUniqueOrThrow({
    where: { id: intent.bookingId }
  });
  const intentAgreement = await transaction.agreement.findUniqueOrThrow({
    where: { id: intent.agreementId }
  });
  const intentTransactions = await transaction.paymentTransaction.findMany({
    where: { paymentIntentId: intent.id },
    orderBy: { createdAt: "asc" }
  });
  const intentReceipt = await transaction.trustReceipt.findUnique({
    where: { paymentIntentId: intent.id }
  });
  if (intent.status === "CONFIRMED" && intentReceipt !== null) {
    return {
      data: {
        paymentIntentId: intent.publicId,
        bookingId: intentBooking.publicId,
        status: PaymentIntentStatus.Confirmed,
        transactionSignature: intentTransactions[0]?.txSignature ?? "mock_tx_confirmed",
        proofId: (
          await transaction.proofRecord.findFirstOrThrow({
            where: { bookingId: intent.bookingId, agreementId: intent.agreementId }
          })
        ).publicId,
        receiptId: intentReceipt.publicId
      }
    };
  }
  if (intent.expiresAt !== null && intent.expiresAt.getTime() < now.getTime()) {
    throw new ApiCommandError(
      410,
      "PAYMENT_INTENT_EXPIRED",
      "Payment intent has expired. Create a new payment intent after confirming valid booking terms."
    );
  }

  const pendingIntentStatus = requireTransition(
    transitionPaymentIntent(intent.status, PaymentIntentStatus.Pending),
    "Payment intent cannot enter verification from its current state."
  );
  if (intent.status !== pendingIntentStatus) {
    await transaction.paymentIntent.update({
      where: { id: intent.id },
      data: { status: pendingIntentStatus }
    });
  }

  const mismatchCode = validateMockPaymentObservation({
    expectedAmountMinor: intent.amountMinor,
    expectedRecipient: intent.recipientWallet,
    expectedReference: intent.solanaReference,
    observedAmountMinor: input.observedAmount.minor,
    observedRecipient: input.observedRecipient,
    observedReference: input.observedReference
  });
  const signature = input.transactionSignature ?? opaqueId("mock_tx");
  const call = await transaction.callSession.findFirstOrThrow({
    where: { bookingId: intent.bookingId }
  });

  if (mismatchCode !== null) {
    await transaction.paymentTransaction.create({
      data: {
        paymentIntentId: intent.id,
        chain: "MOCK",
        txSignature: signature,
        observedAmountMinor: input.observedAmount.minor,
        observedRecipientWallet: input.observedRecipient,
        observedReference: input.observedReference,
        verificationStatus: "REJECTED",
        rejectionReasonCode: mismatchCode,
        verifiedAt: now,
        rawChainMetadata: asJson({ simulated: true, idempotencyKeyHash, requestFingerprint })
      }
    });
    await transaction.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: requireTransition(
          transitionPaymentIntent(pendingIntentStatus, PaymentIntentStatus.Rejected),
          "Payment intent cannot be rejected from its current state."
        )
      }
    });
    await transitionBookingThrough(transaction, intent.bookingId, intentBooking.status, [
      BookingStatus.ManualReviewRequired
    ]);
    await appendEvent(transaction, {
      callId: call.publicId,
      bookingId: intentBooking.publicId,
      event: EventName.PaymentFailed,
      data: {
        paymentIntentId: intent.publicId,
        status: PaymentIntentStatus.Rejected,
        errorCode: mismatchCode,
        retryable: false,
        customerMessage: "Payment did not match the locked agreement."
      },
      requestId,
      occurredAt: now
    });
    return {
      error: {
        statusCode: 422,
        code: mismatchCode,
        message: "Payment verification failed closed."
      }
    };
  }

  const transactionRecord = await transaction.paymentTransaction.create({
    data: {
      paymentIntentId: intent.id,
      chain: "MOCK",
      txSignature: signature,
      observedAmountMinor: input.observedAmount.minor,
      observedRecipientWallet: input.observedRecipient,
      observedReference: input.observedReference,
      verificationStatus: "CONFIRMED",
      verifiedAt: now,
      rawChainMetadata: asJson({ simulated: true, idempotencyKeyHash, requestFingerprint })
    }
  });
  await transaction.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: requireTransition(
        transitionPaymentIntent(pendingIntentStatus, PaymentIntentStatus.Confirmed),
        "Payment intent cannot be confirmed from its current state."
      )
    }
  });
  await transaction.inventoryHold.updateMany({
    where: { bookingId: intent.bookingId, status: "ACTIVE" },
    data: { status: "CONSUMED", consumedAt: now }
  });
  await transitionBookingThrough(transaction, intent.bookingId, intentBooking.status, [
    BookingStatus.PaymentConfirmed,
    BookingStatus.BookingConfirmed,
    BookingStatus.ReceiptIssued
  ]);
  const proof = await createVerifiedProofRecord(transaction, {
    bookingId: intent.bookingId,
    agreementId: intent.agreementId,
    paymentTransactionId: transactionRecord.id,
    agreementHash: intentAgreement.payloadHashSha256,
    reference: intent.solanaReference,
    now
  });
  const receipt = await createVerifiedTrustReceipt(transaction, {
    bookingId: intent.bookingId,
    paymentIntentId: intent.id,
    proofRecordId: proof.id,
    receiptPayload: {
      bookingId: intentBooking.publicId,
      route: `${intentBooking.routeFrom} → ${intentBooking.routeTo}`,
      contactPhoneMasked: intentBooking.contactPhoneMasked,
      deposit: intent.amountMinor,
      agreementVersion: intentAgreement.version
    },
    now
  });
  await appendEvent(transaction, {
    callId: call.publicId,
    bookingId: intentBooking.publicId,
    event: EventName.PaymentConfirmed,
    data: {
      paymentIntentId: intent.publicId,
      status: PaymentIntentStatus.Confirmed,
      transactionSignatureShort: shortSignature(signature),
      verifiedAt: iso(now),
      nextAction: RiskNextAction.IssueReceipt
    },
    requestId,
    occurredAt: now
  });
  await appendEvent(transaction, {
    callId: call.publicId,
    bookingId: intentBooking.publicId,
    event: EventName.ReceiptCreated,
    data: { receiptId: receipt.publicId, status: "ISSUED", verification: ProofStatus.Pending },
    requestId,
    occurredAt: now
  });
  await appendEvent(transaction, {
    callId: call.publicId,
    bookingId: intentBooking.publicId,
    event: EventName.ReceiptVerified,
    data: {
      receiptId: receipt.publicId,
      status: "VERIFIED_MATCH",
      verification: ProofStatus.Match,
      agreementVersion: intentAgreement.version,
      verifiedAt: iso(now)
    },
    requestId,
    occurredAt: now
  });
  return {
    data: {
      paymentIntentId: intent.publicId,
      bookingId: intentBooking.publicId,
      status: PaymentIntentStatus.Confirmed,
      transactionSignature: signature,
      proofId: proof.publicId,
      receiptId: receipt.publicId
    }
  };
}

export function verifyPaymentInTransaction(
  client: DatabaseClient,
  input: VerifyMockPaymentRequest,
  idempotencyKey: string,
  requestId: string
): Promise<ServiceData> {
  return client
    .$transaction((transaction) =>
      verifyPayment(transaction, input, idempotencyKey, requestId, new Date())
    )
    .then((result) => {
      if ("error" in result) {
        throw new ApiCommandError(result.error.statusCode, result.error.code, result.error.message);
      }
      return result.data;
    });
}
