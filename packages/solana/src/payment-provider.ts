import { verifyDevnetPayment } from "./devnet-verifier.js";
import { createPrivacySafeMemo, readMemoAmountLamports } from "./memo.js";
import { assertSolanaPublicKey, generatePaymentReference } from "./reference.js";
import { JsonRpcSolanaClient, SolanaRpcTimeoutError } from "./rpc-client.js";
import { createSolanaPayUrl, formatLamportsAsSol } from "./solana-pay-url.js";
import type {
  CreateProviderIntentInput,
  PaymentProvider,
  ProviderPaymentIntent,
  ProviderPaymentVerification,
  SolanaCommitment,
  SolanaRpcClient,
  VerifyProviderPaymentInput
} from "./types.js";

export type SolanaDevnetPaymentProviderOptions = {
  rpcUrl: string;
  recipientPublicKey: string;
  amountLamports: number;
  label: string;
  commitment: SolanaCommitment;
  rpcClient?: SolanaRpcClient;
};

const DEVNET_MESSAGE = "Devnet demonstration proof payment - not commercial settlement";

export class SolanaDevnetPaymentProvider implements PaymentProvider {
  readonly name = "solana_devnet" as const;
  readonly #recipientPublicKey: string;
  readonly #amountLamports: number;
  readonly #label: string;
  readonly #commitment: SolanaCommitment;
  readonly #rpcClient: SolanaRpcClient;

  constructor(options: SolanaDevnetPaymentProviderOptions) {
    assertSolanaPublicKey(options.recipientPublicKey, "SOLANA_RECIPIENT_PUBLIC_KEY");
    if (!Number.isSafeInteger(options.amountLamports) || options.amountLamports <= 0) {
      throw new Error("SOLANA_DEMO_AMOUNT_LAMPORTS must be a positive safe integer.");
    }
    if (options.label.trim().length === 0) {
      throw new Error("SOLANA_PAYMENT_LABEL must not be empty.");
    }
    this.#recipientPublicKey = options.recipientPublicKey;
    this.#amountLamports = options.amountLamports;
    this.#label = options.label;
    this.#commitment = options.commitment;
    this.#rpcClient = options.rpcClient ?? new JsonRpcSolanaClient({ rpcUrl: options.rpcUrl });
  }

  async createIntent(input: CreateProviderIntentInput): Promise<ProviderPaymentIntent> {
    const recipient = input.persisted?.recipient ?? this.#recipientPublicKey;
    const reference = input.persisted?.reference ?? generatePaymentReference();
    const memo =
      input.persisted?.memo ??
      createPrivacySafeMemo({
        reference,
        agreementHash: input.agreementHash,
        amountLamports: this.#amountLamports
      });
    const amountLamports =
      input.persisted === undefined ? this.#amountLamports : readMemoAmountLamports(memo);
    const solanaPayUrl = createSolanaPayUrl({
      recipient,
      amountLamports,
      reference,
      label: this.#label,
      message: DEVNET_MESSAGE,
      memo
    });

    return {
      provider: this.name,
      chain: "SOLANA_DEVNET",
      recipient,
      reference,
      memo,
      paymentAmount: {
        currency: "SOL",
        minor: amountLamports,
        display: formatLamportsAsSol(amountLamports)
      },
      solanaPayUrl,
      qrPayload: solanaPayUrl
    };
  }

  async verifyPayment(input: VerifyProviderPaymentInput): Promise<ProviderPaymentVerification> {
    const transactionSignature = input.observation.transactionSignature;
    if (transactionSignature !== undefined) {
      return verifyDevnetPayment(this.#rpcClient, {
        transactionSignature,
        expectedRecipient: input.expected.recipient,
        expectedAmountLamports: readMemoAmountLamports(input.expected.memo),
        expectedReference: input.expected.reference,
        commitment: this.#commitment
      });
    }

    let candidates;
    try {
      candidates = await this.#rpcClient.getSignaturesForAddress(
        input.expected.reference,
        this.#commitment,
        10
      );
    } catch (error) {
      const timeout = error instanceof SolanaRpcTimeoutError;
      return {
        status: "FAILED",
        chain: "SOLANA_DEVNET",
        transactionSignature: "",
        metadata: { cluster: "devnet" },
        error: {
          code: timeout ? "SOLANA_RPC_TIMEOUT" : "SOLANA_RPC_UNAVAILABLE",
          httpStatus: timeout ? 504 : 503,
          retryable: true,
          message: timeout
            ? "Solana Devnet discovery timed out."
            : "Solana Devnet discovery is temporarily unavailable."
        }
      };
    }

    if (candidates.length === 0) {
      return {
        status: "PENDING",
        chain: "SOLANA_DEVNET",
        transactionSignature: "",
        metadata: { cluster: "devnet", discovery: "reference" },
        error: {
          code: "PAYMENT_TRANSACTION_NOT_FOUND",
          httpStatus: 202,
          retryable: true,
          message: "No Devnet transaction has been found for this payment reference yet."
        }
      };
    }

    let pending: ProviderPaymentVerification | undefined;
    let rejected: ProviderPaymentVerification | undefined;
    for (const candidate of candidates) {
      const result = await verifyDevnetPayment(this.#rpcClient, {
        transactionSignature: candidate.signature,
        expectedRecipient: input.expected.recipient,
        expectedAmountLamports: readMemoAmountLamports(input.expected.memo),
        expectedReference: input.expected.reference,
        commitment: this.#commitment
      });
      if (result.status === "CONFIRMED") return result;
      if (result.status === "PENDING" || result.status === "FAILED") pending ??= result;
      else rejected ??= result;
    }

    return pending ?? rejected!;
  }
}
