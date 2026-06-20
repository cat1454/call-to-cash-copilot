import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  type ErrorCode
} from "@call-to-cash/shared";

export function successEnvelope<T>(requestId: string, data: T) {
  return ApiSuccessEnvelopeSchema.parse({
    success: true as const,
    data,
    meta: { requestId }
  });
}

export function errorEnvelope(
  requestId: string,
  code: ErrorCode,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
) {
  return ApiErrorEnvelopeSchema.parse({
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      requestId,
      retryable
    }
  });
}
