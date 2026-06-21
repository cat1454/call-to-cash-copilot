export class AgoraAdapterError extends Error {
  constructor(
    readonly code: "AGORA_TOKEN_ISSUE_FAILED" | "AGORA_CHANNEL_UNAVAILABLE",
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}
