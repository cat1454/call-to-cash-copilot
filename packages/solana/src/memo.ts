import { assertSolanaPublicKey } from "./reference.js";

const MEMO_PATTERN = /^ctc:v1:ref:([1-9A-HJ-NP-Za-km-z]+):proof:([a-f0-9]+):amt:([a-z0-9]+)$/u;

function assertAmountLamports(amountLamports: number): void {
  if (!Number.isSafeInteger(amountLamports) || amountLamports <= 0) {
    throw new Error("amountLamports must be a positive safe integer.");
  }
}

export function createPrivacySafeMemo(input: {
  reference: string;
  agreementHash: string;
  amountLamports: number;
}): string {
  assertSolanaPublicKey(input.reference, "reference");
  if (!/^[a-f0-9]{64}$/u.test(input.agreementHash)) {
    throw new Error("agreementHash must be a lowercase SHA-256 hash.");
  }
  assertAmountLamports(input.amountLamports);

  return `ctc:v1:ref:${input.reference.slice(0, 10)}:proof:${input.agreementHash.slice(0, 12)}:amt:${input.amountLamports.toString(36)}`;
}

export function readMemoAmountLamports(memo: string): number {
  const match = MEMO_PATTERN.exec(memo);
  const encodedAmount = match?.[3];
  if (encodedAmount === undefined) {
    throw new Error("Payment memo is not a supported Call-to-Cash memo.");
  }
  const amountLamports = Number.parseInt(encodedAmount, 36);
  assertAmountLamports(amountLamports);
  return amountLamports;
}
