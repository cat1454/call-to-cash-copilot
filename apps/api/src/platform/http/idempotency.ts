import { ApiCommandError } from "./api-command-error.js";

export function requireIdempotencyKey(headers: Record<string, unknown>): string {
  const value = headers["idempotency-key"];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiCommandError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key is required.");
  }

  return value;
}
