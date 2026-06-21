import { transitionPaymentIntent } from "@call-to-cash/domain";
import type { DatabaseClient } from "@call-to-cash/db";
import {
  BookingStatus,
  EventName,
  PaymentIntentStatus,
  ProofStatus,
  RiskNextAction,
  type ErrorCode,
  type VerifyPaymentRequest
} from "@call-to-cash/shared";
import type {
  PaymentProvider,
  ProviderPaymentVerification,
  VerifyProviderPaymentInput
} from "@call-to-cash/solana";

import { appendEvent } from "../../../platform/events/event-log.js";
import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import { createVerifiedProofRecord } from "../proof/create-proof-record.js";
import { createVerifiedTrustReceipt } from "../proof/create-trust-receipt.js";
import type { ServiceData, Transaction } from "../types.js";
import {
  asJson,
  iso,
  requireTransition,
  sha256,
  shortSignature,
  transitionBookingThrough
} from "../types.js";

type PaymentVerificationResult =
  | { data: ServiceData }
  | {
      error: {
        statusCode: number;
        code: ErrorCode;
        message: string;
        retryable: boolean;
      };
    };

type NormalizedVerification = Omit<ProviderPaymentVerification, "error"> & {
  error?: {
    code: ErrorCode;
    httpStatus: number;
    retryable: boolean;
    message: string;
  };
  skipTransactionPersistence?: boolean;
};

function requestFingerprint(input: VerifyPaymentRequest): string {
  return sha256(JSON.stringify(input));
}

function providerMatchesMemo(provider: PaymentProvider, memo: string): boolean {
  return (
    (provider.name === "mock" && memo.startsWith("mock:")) ||
    (provider.name === "solana_devnet" && memo.startsWith("ctc:v1:"))
  );
}

function toProviderInput(
  intent: {
    amountMinor: number;
    recipientWallet: string;
    solanaReference: string;
    memoReference: string;
    expiresAt: Date;
  },
  input: VerifyPaymentRequest,
  now: Date
): VerifyProviderPaymentInput {
  return {
    expected: {
      amountMinor: intent.amountMinor,
      recipient: intent.recipientWallet,
      reference: intent.solanaReference,
      memo: intent.memoReference,
      expiresAt: intent.expiresAt
    },
    observation: {
      ...(!("transactionSignature" in input) || input.transactionSignature === undefined
        ? {}
        : { transactionSignature: input.transactionSignature }),
      ...("observedAmount" in input ? { amountMinor: input.observedAmount.minor } : {}),
      ...("observedRecipient" in input ? { recipient: input.observedRecipient } : {}),
      ...("observedReference" in input ? { reference: input.observedReference } : {})
    },
    now
  };
}

async function confirmedResult(
  client: DatabaseClient,
  intent: { id: string; publicId: string; bookingId: string; agreementId: string }
): Promise<ServiceData | null> {
  const receipt = await client.trustReceipt.findUnique({ where: { paymentIntentId: intent.id } });
  if (receipt === null) return null;
  const [booking, transaction, proof] = await Promise.all([
    client.booking.findUniqueOrThrow({
      where: { id: intent.bookingId },
      select: { publicId: true }
    }),
    client.paymentTransaction.findFirst({
      where: { paymentIntentId: intent.id, verificationStatus: "CONFIRMED" },
      orderBy: { createdAt: "asc" }
    }),
    client.proofRecord.findFirstOrThrow({
      where: { bookingId: intent.bookingId, agreementId: intent.agreementId }
    })
  ]);
  return {
    paymentIntentId: intent.publicId,
    bookingId: booking.publicId,
    status: PaymentIntentStatus.Confirmed,
    transactionSignature: transaction?.txSignature ?? "confirmed_transaction",
    proofId: proof.publicId,
    receiptId: receipt.publicId
  };
}

async function resolveReplay(
  transaction: Transaction,
  replay: {
    id: string;
    paymentIntentId: string;
    txSignature: string;
    verificationStatus: string;
    rejectionReasonCode: string | null;
    rawChainMetadata: unknown;
  },
  input: VerifyPaymentRequest,
  fingerprint: string
): Promise<PaymentVerificationResult> {
  const replayIntent = await transaction.paymentIntent.findUniqueOrThrow({
    where: { id: replay.paymentIntentId }
  });
  const replayMetadata = replay.rawChainMetadata as { requestFingerprint?: string } | null;
  if (
    replayIntent.publicId !== input.paymentIntentId ||
    replayMetadata?.requestFingerprint !== fingerprint
  ) {
    throw new ApiCommandError(
      409,
      "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      "Idempotency key was already used with another verification payload."
    );
  }
  if (replay.verificationStatus === "REJECTED") {
    return {
      error: {
        statusCode: 422,
        code: (replay.rejectionReasonCode ?? "PAYMENT_VERIFICATION_FAILED") as ErrorCode,
        message: "Payment verification failed closed.",
        retryable: false
      }
    };
  }

  const [booking, receipt, proof] = await Promise.all([
    transaction.booking.findUniqueOrThrow({
      where: { id: replayIntent.bookingId },
      select: { publicId: true }
    }),
    transaction.trustReceipt.findUnique({ where: { paymentIntentId: replayIntent.id } }),
    transaction.proofRecord.findUnique({ where: { paymentTransactionId: replay.id } })
  ]);
  const actualProof =
    proof ??
    (await transaction.proofRecord.findFirst({
      where: { bookingId: replayIntent.bookingId, agreementId: replayIntent.agreementId }
    }));
  if (replay.verificationStatus === "CONFIRMED" && receipt !== null && actualProof !== null) {
    return {
      data: {
        paymentIntentId: replayIntent.publicId,
        bookingId: booking.publicId,
        status: PaymentIntentStatus.Confirmed,
        transactionSignature: replay.txSignature,
        proofId: actualProof.publicId,
        receiptId: receipt.publicId
      }
    };
  }

  return {
    error: {
      statusCode: 409,
      code: "PAYMENT_VERIFICATION_PENDING",
      message: "Payment verification has not completed.",
      retryable: true
    }
  };
}

async function finalizePaymentVerification(
  transaction: Transaction,
  provider: PaymentProvider,
  input: VerifyPaymentRequest,
  verification: NormalizedVerification,
  idempotencyKey: string,
  requestId: string,
  now: Date
): Promise<PaymentVerificationResult> {
  const idempotencyKeyHash = sha256(idempotencyKey);
  const fingerprint = requestFingerprint(input);
  const replay = await transaction.paymentTransaction.findFirst({
    where: { rawChainMetadata: { path: ["idempotencyKeyHash"], equals: idempotencyKeyHash } }
  });
  if (replay !== null) {
    return resolveReplay(transaction, replay, input, fingerprint);
  }

  const intent = await transaction.paymentIntent.findUnique({
    where: { publicId: input.paymentIntentId }
  });
  if (intent === null) {
    throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
  }
  if (!providerMatchesMemo(provider, intent.memoReference)) {
    throw new ApiCommandError(
      409,
      "PAYMENT_CLUSTER_MISMATCH",
      "Payment intent belongs to a different payment provider."
    );
  }
  const intentBooking = await transaction.booking.findUniqueOrThrow({
    where: { id: intent.bookingId }
  });
  const intentAgreement = await transaction.agreement.findUniqueOrThrow({
    where: { id: intent.agreementId }
  });
  if (intent.status === PaymentIntentStatus.Confirmed) {
    const result = await confirmedResult(transaction as unknown as DatabaseClient, intent);
    if (result !== null) return { data: result };
  }
  if (intent.expiresAt.getTime() < now.getTime()) {
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
  const call = await transaction.callSession.findFirstOrThrow({
    where: { bookingId: intent.bookingId }
  });

  if (verification.status === "PENDING" || verification.status === "FAILED") {
    const targetStatus =
      verification.status === "FAILED" ? PaymentIntentStatus.Failed : PaymentIntentStatus.Pending;
    await transaction.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: requireTransition(
          transitionPaymentIntent(pendingIntentStatus, targetStatus),
          "Payment intent cannot record a retryable verification result."
        )
      }
    });
    if (verification.status === "PENDING") {
      await appendEvent(transaction, {
        callId: call.publicId,
        bookingId: intentBooking.publicId,
        event: EventName.PaymentPending,
        data: {
          paymentIntentId: intent.publicId,
          status: PaymentIntentStatus.Pending,
          ...(verification.transactionSignature.length === 0
            ? {}
            : { transactionSignatureShort: shortSignature(verification.transactionSignature) })
        },
        requestId,
        occurredAt: now
      });
    }
    const error = verification.error ?? {
      code: "PAYMENT_VERIFICATION_PENDING" as const,
      httpStatus: 202,
      retryable: true,
      message: "Payment verification is pending."
    };
    return {
      error: {
        statusCode: error.httpStatus,
        code: error.code,
        message: error.message,
        retryable: error.retryable
      }
    };
  }

  const rawChainMetadata = asJson({
    provider: provider.name,
    idempotencyKeyHash,
    requestFingerprint: fingerprint,
    ...verification.metadata
  });

  if (verification.status === "REJECTED") {
    const error = verification.error ?? {
      code: "PAYMENT_VERIFICATION_FAILED" as const,
      httpStatus: 422,
      retryable: false,
      message: "Payment verification failed closed."
    };
    if (verification.skipTransactionPersistence !== true) {
      await transaction.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          chain: verification.chain,
          txSignature: verification.transactionSignature,
          ...(verification.slot === undefined ? {} : { slot: BigInt(verification.slot) }),
          observedAmountMinor: verification.observedAmountMinor ?? null,
          observedRecipientWallet: verification.observedRecipient ?? null,
          observedReference: verification.observedReference ?? null,
          verificationStatus: "REJECTED",
          rejectionReasonCode: error.code,
          verifiedAt: now,
          rawChainMetadata
        }
      });
    }
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
        errorCode: error.code,
        retryable: error.retryable,
        customerMessage: "Payment did not match the locked agreement."
      },
      requestId,
      occurredAt: now
    });
    return {
      error: {
        statusCode: error.httpStatus,
        code: error.code,
        message: error.message,
        retryable: error.retryable
      }
    };
  }

  const transactionRecord = await transaction.paymentTransaction.create({
    data: {
      paymentIntentId: intent.id,
      chain: verification.chain,
      txSignature: verification.transactionSignature,
      ...(verification.slot === undefined ? {} : { slot: BigInt(verification.slot) }),
      submittedAt:
        verification.blockTime === undefined || verification.blockTime === null
          ? null
          : new Date(verification.blockTime * 1000),
      observedAmountMinor: verification.observedAmountMinor ?? null,
      observedRecipientWallet: verification.observedRecipient ?? null,
      observedReference: verification.observedReference ?? null,
      verificationStatus: "CONFIRMED",
      verifiedAt: now,
      rawChainMetadata
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
    chain: verification.chain,
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
      transactionSignatureShort: shortSignature(verification.transactionSignature),
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
      transactionSignature: verification.transactionSignature,
      proofId: proof.publicId,
      receiptId: receipt.publicId
    }
  };
}

export async function verifyPaymentInTransaction(
  client: DatabaseClient,
  provider: PaymentProvider,
  input: VerifyPaymentRequest,
  idempotencyKey: string,
  requestId: string
): Promise<ServiceData> {
  const now = new Date();
  const existingReplay = await client.paymentTransaction.findFirst({
    where: {
      rawChainMetadata: {
        path: ["idempotencyKeyHash"],
        equals: sha256(idempotencyKey)
      }
    }
  });
  if (existingReplay !== null) {
    const replayResult = await client.$transaction((transaction) =>
      resolveReplay(transaction, existingReplay, input, requestFingerprint(input))
    );
    if ("error" in replayResult) {
      throw new ApiCommandError(
        replayResult.error.statusCode,
        replayResult.error.code,
        replayResult.error.message,
        undefined,
        replayResult.error.retryable
      );
    }
    return replayResult.data;
  }
  const intent = await client.paymentIntent.findUnique({
    where: { publicId: input.paymentIntentId }
  });
  if (intent === null) {
    throw new ApiCommandError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
  }
  if (!providerMatchesMemo(provider, intent.memoReference)) {
    throw new ApiCommandError(
      409,
      "PAYMENT_CLUSTER_MISMATCH",
      "Payment intent belongs to a different payment provider."
    );
  }
  if (intent.status === PaymentIntentStatus.Confirmed) {
    const result = await confirmedResult(client, intent);
    if (result !== null) return result;
  }
  if (intent.expiresAt.getTime() < now.getTime()) {
    throw new ApiCommandError(
      410,
      "PAYMENT_INTENT_EXPIRED",
      "Payment intent has expired. Create a new payment intent after confirming valid booking terms."
    );
  }

  let verification: NormalizedVerification;
  const signature = "transactionSignature" in input ? input.transactionSignature : undefined;
  if (signature !== undefined) {
    const consumed = await client.paymentTransaction.findUnique({
      where: { txSignature: signature }
    });
    if (consumed !== null && consumed.paymentIntentId !== intent.id) {
      verification = {
        status: "REJECTED",
        chain: provider.name === "solana_devnet" ? "SOLANA_DEVNET" : "MOCK",
        transactionSignature: signature,
        metadata: { signatureReused: true },
        skipTransactionPersistence: true,
        error: {
          code: "PAYMENT_TRANSACTION_REUSED",
          httpStatus: 409,
          retryable: false,
          message: "Transaction signature has already confirmed another payment intent."
        }
      };
    } else {
      verification = await provider.verifyPayment(toProviderInput(intent, input, now));
    }
  } else {
    verification = await provider.verifyPayment(toProviderInput(intent, input, now));
  }

  if (signature === undefined && verification.transactionSignature.length > 0) {
    const consumed = await client.paymentTransaction.findUnique({
      where: { txSignature: verification.transactionSignature }
    });
    if (consumed !== null && consumed.paymentIntentId !== intent.id) {
      verification = {
        status: "REJECTED",
        chain: provider.name === "solana_devnet" ? "SOLANA_DEVNET" : "MOCK",
        transactionSignature: verification.transactionSignature,
        metadata: { signatureReused: true },
        skipTransactionPersistence: true,
        error: {
          code: "PAYMENT_TRANSACTION_REUSED",
          httpStatus: 409,
          retryable: false,
          message: "Transaction signature has already confirmed another payment intent."
        }
      };
    }
  }

  const result = await client.$transaction((transaction) =>
    finalizePaymentVerification(
      transaction,
      provider,
      input,
      verification,
      idempotencyKey,
      requestId,
      now
    )
  );
  if ("error" in result) {
    throw new ApiCommandError(
      result.error.statusCode,
      result.error.code,
      result.error.message,
      undefined,
      result.error.retryable
    );
  }
  return result.data;
}
