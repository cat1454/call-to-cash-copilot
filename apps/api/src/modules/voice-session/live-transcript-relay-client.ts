import { createHmac } from "node:crypto";

import { AgoraAdapterError } from "@call-to-cash/agora";

type RelayControlConfig = {
  url: string;
  controlSecret: string;
};

type RelaySession = {
  callId: string;
  channelName: string;
  sessionId: string;
  agentUid: number;
  token: string;
};

type RelayRequestOptions = {
  path: string;
  method: "POST" | "DELETE";
  signaturePayload: unknown;
  body?: unknown;
};

function signature(secret: string, payload: unknown): string {
  return `sha256=${createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex")}`;
}

export class AgoraLiveTranscriptRelayClient {
  constructor(
    private readonly config: RelayControlConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async start(session: RelaySession): Promise<void> {
    await this.request({
      path: "/v1/relay/sessions",
      method: "POST",
      signaturePayload: session,
      body: session
    });
  }

  async stop(callId: string): Promise<void> {
    await this.request({
      path: `/v1/relay/sessions/${encodeURIComponent(callId)}`,
      method: "DELETE",
      signaturePayload: { callId }
    });
  }

  private async request({
    path,
    method,
    signaturePayload,
    body
  }: RelayRequestOptions): Promise<void> {
    const hasBody = body !== undefined;

    try {
      const response = await this.fetchImpl(new URL(path, this.config.url), {
        method,
        headers: {
          "x-ctc-relay-signature": signature(
            this.config.controlSecret,
            signaturePayload
          ),
          ...(hasBody ? { "content-type": "application/json" } : {})
        },
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10_000)
      });

      if (method === "DELETE" && response.status === 404) {
        return;
      }

      if (!response.ok) {
        const providerDetail = await safeResponseText(response);
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          `Live transcript relay returned HTTP ${response.status}.`,
          true,
          response.status,
          providerDetail
        );
      }
    } catch (error) {
      if (error instanceof AgoraAdapterError) {
        throw error;
      }

      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Live transcript relay is unavailable.",
        true
      );
    }
  }
}

async function safeResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, 500);
}
