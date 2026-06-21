import { assertSolanaPublicKey } from "./reference.js";

export function formatLamportsAsSol(amountLamports: number): string {
  if (!Number.isSafeInteger(amountLamports) || amountLamports <= 0) {
    throw new Error("amountLamports must be a positive safe integer.");
  }
  const whole = Math.floor(amountLamports / 1_000_000_000);
  const fractional = String(amountLamports % 1_000_000_000)
    .padStart(9, "0")
    .replace(/0+$/u, "");
  return fractional.length === 0 ? String(whole) : `${whole}.${fractional}`;
}

export function createSolanaPayUrl(input: {
  recipient: string;
  amountLamports: number;
  reference: string;
  label: string;
  message: string;
  memo: string;
}): string {
  assertSolanaPublicKey(input.recipient, "recipient");
  assertSolanaPublicKey(input.reference, "reference");
  if (input.label.trim().length === 0 || input.message.trim().length === 0) {
    throw new Error("Solana Pay label and message are required.");
  }

  const url = new URL(`solana:${input.recipient}`);
  url.searchParams.set("amount", formatLamportsAsSol(input.amountLamports));
  url.searchParams.set("reference", input.reference);
  url.searchParams.set("label", input.label);
  url.searchParams.set("message", input.message);
  url.searchParams.set("memo", input.memo);
  return url.toString();
}
