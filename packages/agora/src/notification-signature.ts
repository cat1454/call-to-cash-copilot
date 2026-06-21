import { createHmac, timingSafeEqual } from "node:crypto";

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Verify the server-to-server notification against the exact received bytes. */
export function verifyAgoraNotificationSignature(
  secret: string,
  rawBody: Buffer,
  received: string | undefined
): boolean {
  if (!secret || !received) return false;
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const base64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  const candidate = received.trim();
  return (
    equal(candidate, hex) ||
    equal(candidate, `sha256=${hex}`) ||
    equal(candidate, base64) ||
    equal(candidate, `sha256=${base64}`)
  );
}
