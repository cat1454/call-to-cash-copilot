import { createHmac, timingSafeEqual } from "node:crypto";

export function signJsonPayload(secret: string, payload: unknown): string {
  return `sha256=${createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
}

export function verifyJsonPayload(secret: string, payload: unknown, signature?: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signJsonPayload(secret, payload));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
