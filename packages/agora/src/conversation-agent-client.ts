import { AgoraAdapterError } from "./errors.js";
import type { AgoraAgentSession, AgoraConversationAgentConfig } from "./types.js";

function basicAuthorization(customerId: string, customerSecret: string): string {
  return `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`;
}

function agentIdFrom(response: Record<string, unknown>): string | undefined {
  for (const candidate of [response.agent_id, response.agentId, response.id]) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return undefined;
}

export class AgoraConversationAgentClient {
  constructor(
    private readonly config: AgoraConversationAgentConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async start(input: {
    channelName: string;
    agentToken: string;
    agentUid: number;
    customerUid: number;
    name: string;
  }): Promise<AgoraAgentSession> {
    const response = await this.request(
      `/api/conversational-ai-agent/v2/projects/${this.config.appId}/join`,
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          properties: {
            ...this.config.properties,
            channel: input.channelName,
            token: input.agentToken,
            agent_rtc_uid: String(input.agentUid),
            remote_rtc_uids: [String(input.customerUid)]
          }
        })
      }
    );
    const agentId = agentIdFrom(response);
    if (agentId === undefined) {
      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Agora did not return an agent session id.",
        true
      );
    }
    return { agentId, name: input.name };
  }

  async stop(agentId: string): Promise<void> {
    await this.request(
      `/api/conversational-ai-agent/v2/projects/${this.config.appId}/agents/${encodeURIComponent(agentId)}/leave`,
      { method: "POST" }
    );
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetchImpl(new URL(path, this.config.baseUrl), {
        ...init,
        headers: {
          Authorization: basicAuthorization(this.config.customerId, this.config.customerSecret),
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          "Agora Conversation AI Engine is unavailable.",
          response.status >= 500
        );
      }
      const body: unknown = await response.json().catch(() => ({}));
      return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    } catch (error) {
      if (error instanceof AgoraAdapterError) throw error;
      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Agora Conversation AI Engine is unavailable.",
        true
      );
    }
  }
}
