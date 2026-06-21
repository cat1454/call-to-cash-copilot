export type PaymentProviderName = "mock" | "solana_devnet";
export type PaymentChain = "MOCK" | "SOLANA_DEVNET";
export type SolanaCommitment = "confirmed" | "finalized";
export type SolanaConfirmationStatus = "processed" | "confirmed" | "finalized" | null;

export type PersistedProviderIntent = {
  recipient: string;
  reference: string;
  memo: string;
};

export type CreateProviderIntentInput = {
  agreementHash: string;
  expectedAmountMinor: number;
  persisted?: PersistedProviderIntent;
};

export type ProviderPaymentIntent = {
  provider: PaymentProviderName;
  chain: PaymentChain;
  recipient: string;
  reference: string;
  memo: string;
  paymentAmount: {
    currency: "VND" | "SOL";
    minor: number;
    display: string;
  };
  solanaPayUrl?: string;
  qrPayload?: string;
};

export type VerifyProviderPaymentInput = {
  expected: {
    amountMinor: number;
    recipient: string;
    reference: string;
    memo: string;
    expiresAt: Date;
  };
  observation: {
    transactionSignature?: string;
    amountMinor?: number;
    recipient?: string;
    reference?: string;
  };
  now: Date;
};

export type ProviderVerificationErrorCode =
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_RECIPIENT_MISMATCH"
  | "PAYMENT_REFERENCE_MISMATCH"
  | "PAYMENT_TRANSACTION_FAILED"
  | "PAYMENT_TRANSACTION_NOT_FOUND"
  | "PAYMENT_TRANSACTION_UNCONFIRMED"
  | "PAYMENT_VERIFICATION_FAILED"
  | "SOLANA_RPC_TIMEOUT"
  | "SOLANA_RPC_UNAVAILABLE";

export type ProviderVerificationError = {
  code: ProviderVerificationErrorCode;
  httpStatus: number;
  retryable: boolean;
  message: string;
};

export type ProviderPaymentVerification = {
  status: "CONFIRMED" | "PENDING" | "REJECTED" | "FAILED";
  chain: PaymentChain;
  transactionSignature: string;
  confirmationStatus?: SolanaConfirmationStatus;
  observedRecipient?: string;
  observedAmountMinor?: number;
  observedReference?: string;
  referenceMatched?: boolean;
  slot?: number;
  blockTime?: number | null;
  metadata: Record<string, unknown>;
  error?: ProviderVerificationError;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createIntent(input: CreateProviderIntentInput): Promise<ProviderPaymentIntent>;
  verifyPayment(input: VerifyProviderPaymentInput): Promise<ProviderPaymentVerification>;
}

export type SolanaAccountKey = string | { pubkey: string };

export type SolanaParsedInstruction = {
  program?: string;
  programId?: string;
  parsed?: {
    type?: string;
    info?: Record<string, unknown>;
  };
};

export type SolanaParsedTransaction = {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    innerInstructions?: Array<{ instructions: SolanaParsedInstruction[] }> | null;
  } | null;
  transaction: {
    message: {
      accountKeys: SolanaAccountKey[];
      instructions: SolanaParsedInstruction[];
    };
    signatures: string[];
  };
};

export type SolanaSignatureStatus = {
  confirmationStatus: SolanaConfirmationStatus;
  err: unknown;
};

export type SolanaAddressSignature = SolanaSignatureStatus & {
  signature: string;
};

export interface SolanaRpcClient {
  getSignaturesForAddress(
    address: string,
    commitment: SolanaCommitment,
    limit?: number
  ): Promise<SolanaAddressSignature[]>;
  getTransaction(
    signature: string,
    commitment: SolanaCommitment
  ): Promise<SolanaParsedTransaction | null>;
  getSignatureStatus(signature: string): Promise<SolanaSignatureStatus | null>;
}
