import type { ErrorCode } from "@call-to-cash/shared";

export class ApiCommandError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryable = false
  ) {
    super(message);
  }
}
