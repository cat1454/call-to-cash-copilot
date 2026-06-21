import assert from "node:assert/strict";
import test from "node:test";

import {
  SolanaDevnetPaymentProvider,
  createPrivacySafeMemo,
  createSolanaPayUrl,
  decodeBase58,
  encodeBase58,
  generatePaymentReference,
  verifyDevnetPayment,
  type SolanaParsedTransaction,
  type SolanaRpcClient
} from "./index.js";

const recipient = encodeBase58(new Uint8Array(32).fill(7));
const wrongRecipient = encodeBase58(new Uint8Array(32).fill(8));
const reference = encodeBase58(new Uint8Array(32).fill(9));
const wrongReference = encodeBase58(new Uint8Array(32).fill(10));
const signature = encodeBase58(new Uint8Array(64).fill(11));
const amountLamports = 1_000_000;
const agreementHash = "a".repeat(64);

function transactionFixture(
  overrides: {
    destination?: string;
    lamports?: number;
    includeReference?: boolean;
    failed?: boolean;
  } = {}
): SolanaParsedTransaction {
  const destination = overrides.destination ?? recipient;
  const accountKeys = [
    { pubkey: encodeBase58(new Uint8Array(32).fill(3)) },
    { pubkey: destination },
    ...(overrides.includeReference === false ? [] : [{ pubkey: reference }])
  ];

  return {
    slot: 123_456,
    blockTime: 1_782_000_000,
    meta: {
      err: overrides.failed === true ? { InstructionError: [0, "Custom"] } : null,
      innerInstructions: []
    },
    transaction: {
      message: {
        accountKeys,
        instructions: [
          {
            program: "system",
            parsed: {
              type: "transfer",
              info: {
                source: accountKeys[0]?.pubkey,
                destination,
                lamports: overrides.lamports ?? amountLamports
              }
            }
          }
        ]
      },
      signatures: [signature]
    }
  };
}

function rpcFixture(
  input: {
    transaction?: SolanaParsedTransaction | null;
    confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
    statusError?: unknown;
  } = {}
): SolanaRpcClient {
  return {
    async getSignaturesForAddress() {
      return [
        { signature, confirmationStatus: input.confirmationStatus ?? "confirmed", err: null }
      ];
    },
    async getTransaction() {
      return input.transaction === undefined ? transactionFixture() : input.transaction;
    },
    async getSignatureStatus() {
      return {
        confirmationStatus: input.confirmationStatus ?? "confirmed",
        err: input.statusError ?? null
      };
    }
  };
}

const verificationInput = {
  transactionSignature: signature,
  expectedRecipient: recipient,
  expectedAmountLamports: amountLamports,
  expectedReference: reference,
  commitment: "confirmed" as const
};

test("Solana Pay URL includes the server recipient, amount, reference, label, message, and memo", () => {
  const memo = createPrivacySafeMemo({ reference, agreementHash, amountLamports });
  const value = createSolanaPayUrl({
    recipient,
    amountLamports,
    reference,
    label: "Call-to-Cash Demo",
    message: "Devnet demonstration proof payment",
    memo
  });
  const url = new URL(value);

  assert.equal(url.protocol, "solana:");
  assert.equal(url.pathname, recipient);
  assert.equal(url.searchParams.get("amount"), "0.001");
  assert.equal(url.searchParams.get("reference"), reference);
  assert.equal(url.searchParams.get("label"), "Call-to-Cash Demo");
  assert.equal(url.searchParams.get("message"), "Devnet demonstration proof payment");
  assert.equal(url.searchParams.get("memo"), memo);
});

test("payment references are unique base58 encodings of exactly 32 bytes", () => {
  const first = generatePaymentReference();
  const second = generatePaymentReference();

  assert.notEqual(first, second);
  assert.equal(decodeBase58(first).length, 32);
  assert.equal(decodeBase58(second).length, 32);
  assert.match(first, /^[1-9A-HJ-NP-Za-km-z]+$/u);
});

test("memo contains only opaque reference, proof, and amount fragments", () => {
  const memo = createPrivacySafeMemo({ reference, agreementHash, amountLamports });
  const serialized = JSON.stringify({ memo, reference });

  assert.match(memo, /^ctc:v1:ref:[1-9A-HJ-NP-Za-km-z]+:proof:[a-f0-9]+:amt:[a-z0-9]+$/u);
  assert.doesNotMatch(serialized, /0912345678|person@example\.com|Ha Noi|Sa Pa|3 guests/iu);
});

test("Solana provider creates a Devnet-only request without PII-shaped metadata", async () => {
  const provider = new SolanaDevnetPaymentProvider({
    rpcUrl: "https://api.devnet.solana.com",
    recipientPublicKey: recipient,
    amountLamports,
    label: "Call-to-Cash Demo",
    commitment: "confirmed"
  });
  const intent = await provider.createIntent({
    agreementHash,
    expectedAmountMinor: 300_000
  });

  assert.equal(intent.provider, "solana_devnet");
  assert.equal(intent.chain, "SOLANA_DEVNET");
  assert.equal(intent.paymentAmount.currency, "SOL");
  assert.equal(intent.paymentAmount.minor, amountLamports);
  assert.equal(decodeBase58(intent.reference).length, 32);
  assert.equal(intent.solanaPayUrl, intent.qrPayload);
  assert.doesNotMatch(JSON.stringify(intent), /0912345678|transcript|canonicalPayload/iu);
});

test("verifier returns pending when the transaction is missing", async () => {
  const result = await verifyDevnetPayment(rpcFixture({ transaction: null }), verificationInput);
  assert.equal(result.status, "PENDING");
  assert.equal(result.error?.code, "PAYMENT_TRANSACTION_NOT_FOUND");
  assert.equal(result.error?.retryable, true);
});

test("verifier rejects an unconfirmed or failed transaction", async () => {
  const unconfirmed = await verifyDevnetPayment(
    rpcFixture({ confirmationStatus: "processed" }),
    verificationInput
  );
  const failed = await verifyDevnetPayment(
    rpcFixture({ transaction: transactionFixture({ failed: true }) }),
    verificationInput
  );

  assert.equal(unconfirmed.status, "PENDING");
  assert.equal(unconfirmed.error?.code, "PAYMENT_TRANSACTION_UNCONFIRMED");
  assert.equal(failed.status, "REJECTED");
  assert.equal(failed.error?.code, "PAYMENT_TRANSACTION_FAILED");
});

test("verifier rejects wrong recipient, amount, or reference", async () => {
  const recipientMismatch = await verifyDevnetPayment(
    rpcFixture({ transaction: transactionFixture({ destination: wrongRecipient }) }),
    verificationInput
  );
  const amountMismatch = await verifyDevnetPayment(
    rpcFixture({ transaction: transactionFixture({ lamports: amountLamports - 1 }) }),
    verificationInput
  );
  const referenceMismatch = await verifyDevnetPayment(
    rpcFixture({ transaction: transactionFixture({ includeReference: false }) }),
    { ...verificationInput, expectedReference: wrongReference }
  );

  assert.equal(recipientMismatch.error?.code, "PAYMENT_RECIPIENT_MISMATCH");
  assert.equal(amountMismatch.error?.code, "PAYMENT_AMOUNT_MISMATCH");
  assert.equal(referenceMismatch.error?.code, "PAYMENT_REFERENCE_MISMATCH");
});

test("verifier accepts a confirmed matching transaction fixture", async () => {
  const result = await verifyDevnetPayment(rpcFixture(), verificationInput);

  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.transactionSignature, signature);
  assert.equal(result.confirmationStatus, "confirmed");
  assert.equal(result.observedRecipient, recipient);
  assert.equal(result.observedAmountMinor, amountLamports);
  assert.equal(result.observedReference, reference);
  assert.equal(result.referenceMatched, true);
  assert.equal(result.slot, 123_456);
  assert.equal(result.blockTime, 1_782_000_000);
});

test("provider discovers and verifies a transaction from the payment reference", async () => {
  const rpcClient = {
    async getSignaturesForAddress(value: string) {
      assert.equal(value, reference);
      return [{ signature, confirmationStatus: "confirmed", err: null }];
    },
    async getTransaction() {
      return transactionFixture();
    },
    async getSignatureStatus() {
      return { confirmationStatus: "confirmed", err: null };
    }
  } as unknown as SolanaRpcClient;
  const provider = new SolanaDevnetPaymentProvider({
    rpcUrl: "https://api.devnet.solana.com",
    recipientPublicKey: recipient,
    amountLamports,
    label: "Call-to-Cash Demo",
    commitment: "confirmed",
    rpcClient
  });

  const result = await provider.verifyPayment({
    expected: {
      amountMinor: 300_000,
      recipient,
      reference,
      memo: createPrivacySafeMemo({ reference, agreementHash, amountLamports }),
      expiresAt: new Date("2026-06-21T12:00:00.000Z")
    },
    observation: {},
    now: new Date("2026-06-21T11:00:00.000Z")
  });

  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.transactionSignature, signature);
});
