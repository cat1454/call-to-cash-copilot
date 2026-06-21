export class AgoraAdapterError extends Error {
  constructor(
    readonly code: "AGORA_TOKEN_ISSUE_FAILED" | "AGORA_CHANNEL_UNAVAILABLE",
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
    readonly providerDetail?: string,
    readonly providerReason?: string
  ) {
    super(message);
  }
}
