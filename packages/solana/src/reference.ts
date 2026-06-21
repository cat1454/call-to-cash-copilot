import { randomBytes } from "node:crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  let leadingZeroCount = 0;
  while (leadingZeroCount < bytes.length && bytes[leadingZeroCount] === 0) {
    leadingZeroCount += 1;
  }

  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);

  let encoded = "";
  while (value > 0n) {
    const index = Number(value % 58n);
    encoded = `${BASE58_ALPHABET[index]}${encoded}`;
    value /= 58n;
  }

  return `${"1".repeat(leadingZeroCount)}${encoded}`;
}

export function decodeBase58(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array();

  let leadingZeroCount = 0;
  while (leadingZeroCount < value.length && value[leadingZeroCount] === "1") {
    leadingZeroCount += 1;
  }

  let decodedValue = 0n;
  for (const character of value) {
    const index = BASE58_INDEX.get(character);
    if (index === undefined) throw new Error("Value is not valid base58.");
    decodedValue = decodedValue * 58n + BigInt(index);
  }

  const decoded: number[] = [];
  while (decodedValue > 0n) {
    decoded.unshift(Number(decodedValue % 256n));
    decodedValue /= 256n;
  }

  return Uint8Array.from([...new Array<number>(leadingZeroCount).fill(0), ...decoded]);
}

export function assertSolanaPublicKey(value: string, fieldName = "public key"): void {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase58(value);
  } catch {
    throw new Error(`${fieldName} must be a base58-encoded 32-byte value.`);
  }
  if (bytes.length !== 32) {
    throw new Error(`${fieldName} must be a base58-encoded 32-byte value.`);
  }
}

export function assertSolanaSignature(value: string): void {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase58(value);
  } catch {
    throw new Error("Transaction signature must be a base58-encoded 64-byte value.");
  }
  if (bytes.length !== 64) {
    throw new Error("Transaction signature must be a base58-encoded 64-byte value.");
  }
}

export function generatePaymentReference(): string {
  return encodeBase58(randomBytes(32));
}
