import { createHmac } from "node:crypto";

import { AgoraAdapterError } from "@call-to-cash/agora";

type RelayControlConfig = { url: string; controlSecret: string };
type RelaySession = {
  callId: string;
  channelName: string;
  sessionId: string;
  agentUid: number;
  token: string;
};

function signature(secret: string, payload: unknown): string {
  return `sha256=${createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
}

export class AgoraLiveTranscriptRelayClient {
  constructor(
    private readonly config: RelayControlConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async start(session: RelaySession): Promise<void> {
    await this.request("/v1/relay/sessions", "POST", session);
  }

  async stop(callId: string): Promise<void> {
    await this.request(`/v1/relay/sessions/${encodeURIComponent(callId)}`, "DELETE", { callId });
  }

  private async request(path: string, method: "POST" | "DELETE", payload: unknown): Promise<void> {
    try {
      const response = await this.fetchImpl(new URL(path, this.config.url), {
        method,
        headers: {
          "content-type": "application/json",
          "x-ctc-relay-signature": signature(this.config.controlSecret, payload)
        },
        ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          "Live transcript relay is unavailable.",
          true,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof AgoraAdapterError) throw error;
      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Live transcript relay is unavailable.",
        true
      );
    }
  }
}
