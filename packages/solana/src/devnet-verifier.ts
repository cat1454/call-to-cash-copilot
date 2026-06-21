import { SolanaRpcTimeoutError, SolanaRpcUnavailableError } from "./rpc-client.js";
import { assertSolanaPublicKey, assertSolanaSignature } from "./reference.js";
import type {
  ProviderPaymentVerification,
  ProviderVerificationError,
  SolanaCommitment,
  SolanaConfirmationStatus,
  SolanaParsedInstruction,
  SolanaRpcClient
} from "./types.js";

export type VerifyDevnetPaymentInput = {
  transactionSignature: string;
  expectedRecipient: string;
  expectedAmountLamports: number;
  expectedReference: string;
  commitment: SolanaCommitment;
};

function failure(
  input: VerifyDevnetPaymentInput,
  status: ProviderPaymentVerification["status"],
  error: ProviderVerificationError,
  metadata: Record<string, unknown> = {}
): ProviderPaymentVerification {
  return {
    status,
    chain: "SOLANA_DEVNET",
    transactionSignature: input.transactionSignature,
    metadata: { cluster: "devnet", ...metadata },
    error
  };
}

function isCommitmentSatisfied(
  actual: SolanaConfirmationStatus,
  required: SolanaCommitment
): boolean {
  return required === "finalized"
    ? actual === "finalized"
    : actual === "confirmed" || actual === "finalized";
}

function accountKey(value: string | { pubkey: string }): string {
  return typeof value === "string" ? value : value.pubkey;
}

function readTransfer(instruction: SolanaParsedInstruction): {
  destination: string;
  lamports: number;
} | null {
  if (instruction.program !== "system" || instruction.parsed?.type !== "transfer") return null;
  const destination = instruction.parsed.info?.destination;
  const lamports = instruction.parsed.info?.lamports;
  return typeof destination === "string" && typeof lamports === "number"
    ? { destination, lamports }
    : null;
}

export async function verifyDevnetPayment(
  rpcClient: SolanaRpcClient,
  input: VerifyDevnetPaymentInput
): Promise<ProviderPaymentVerification> {
  assertSolanaSignature(input.transactionSignature);
  assertSolanaPublicKey(input.expectedRecipient, "expected recipient");
  assertSolanaPublicKey(input.expectedReference, "expected reference");

  try {
    const signatureStatus = await rpcClient.getSignatureStatus(input.transactionSignature);
    if (signatureStatus === null) {
      return failure(input, "PENDING", {
        code: "PAYMENT_TRANSACTION_NOT_FOUND",
        httpStatus: 404,
        retryable: true,
        message: "The Devnet transaction is not available yet."
      });
    }
    if (signatureStatus.err !== null) {
      return failure(input, "REJECTED", {
        code: "PAYMENT_TRANSACTION_FAILED",
        httpStatus: 422,
        retryable: false,
        message: "The Devnet transaction failed."
      });
    }
    if (!isCommitmentSatisfied(signatureStatus.confirmationStatus, input.commitment)) {
      return failure(
        input,
        "PENDING",
        {
          code: "PAYMENT_TRANSACTION_UNCONFIRMED",
          httpStatus: 202,
          retryable: true,
          message: "The Devnet transaction has not reached the required confirmation."
        },
        { confirmationStatus: signatureStatus.confirmationStatus }
      );
    }

    const transaction = await rpcClient.getTransaction(
      input.transactionSignature,
      input.commitment
    );
    if (transaction === null) {
      return failure(input, "PENDING", {
        code: "PAYMENT_TRANSACTION_NOT_FOUND",
        httpStatus: 404,
        retryable: true,
        message: "The Devnet transaction is not available yet."
      });
    }
    if (transaction.meta?.err !== null && transaction.meta?.err !== undefined) {
      return failure(input, "REJECTED", {
        code: "PAYMENT_TRANSACTION_FAILED",
        httpStatus: 422,
        retryable: false,
        message: "The Devnet transaction failed."
      });
    }

    const instructions = [
      ...transaction.transaction.message.instructions,
      ...(transaction.meta?.innerInstructions ?? []).flatMap((entry) => entry.instructions)
    ];
    const transfers = instructions
      .map(readTransfer)
      .filter(
        (transfer): transfer is { destination: string; lamports: number } => transfer !== null
      );
    const matchingTransfers = transfers.filter(
      (transfer) => transfer.destination === input.expectedRecipient
    );
    const observedRecipient = matchingTransfers[0]?.destination ?? transfers[0]?.destination;
    const observedAmount = matchingTransfers.reduce(
      (total, transfer) => total + transfer.lamports,
      0
    );
    const accountKeys = transaction.transaction.message.accountKeys.map(accountKey);
    const referenceMatched = accountKeys.includes(input.expectedReference);
    const common = {
      confirmationStatus: signatureStatus.confirmationStatus,
      ...(observedRecipient === undefined ? {} : { observedRecipient }),
      observedAmountMinor: observedAmount,
      ...(referenceMatched ? { observedReference: input.expectedReference } : {}),
      referenceMatched,
      slot: transaction.slot,
      blockTime: transaction.blockTime,
      metadata: {
        cluster: "devnet",
        confirmationStatus: signatureStatus.confirmationStatus,
        slot: transaction.slot,
        blockTime: transaction.blockTime,
        referenceMatched
      }
    };

    if (matchingTransfers.length === 0) {
      return {
        ...failure(input, "REJECTED", {
          code: "PAYMENT_RECIPIENT_MISMATCH",
          httpStatus: 422,
          retryable: false,
          message: "The Devnet transfer recipient does not match the payment intent."
        }),
        ...common
      };
    }
    if (observedAmount !== input.expectedAmountLamports) {
      return {
        ...failure(input, "REJECTED", {
          code: "PAYMENT_AMOUNT_MISMATCH",
          httpStatus: 422,
          retryable: false,
          message: "The Devnet transfer amount does not match the payment intent."
        }),
        ...common
      };
    }
    if (!referenceMatched) {
      return {
        ...failure(input, "REJECTED", {
          code: "PAYMENT_REFERENCE_MISMATCH",
          httpStatus: 422,
          retryable: false,
          message: "The Devnet transaction reference does not match the payment intent."
        }),
        ...common
      };
    }

    return {
      status: "CONFIRMED",
      chain: "SOLANA_DEVNET",
      transactionSignature: input.transactionSignature,
      ...common,
      observedReference: input.expectedReference
    };
  } catch (error) {
    if (error instanceof SolanaRpcTimeoutError) {
      return failure(input, "FAILED", {
        code: "SOLANA_RPC_TIMEOUT",
        httpStatus: 504,
        retryable: true,
        message: "Solana Devnet verification timed out."
      });
    }
    if (error instanceof SolanaRpcUnavailableError) {
      return failure(input, "FAILED", {
        code: "SOLANA_RPC_UNAVAILABLE",
        httpStatus: 503,
        retryable: true,
        message: "Solana Devnet verification is temporarily unavailable."
      });
    }
    throw error;
  }
}
