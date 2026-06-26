import { AgoraAdapterError } from "./errors.js";
import { withCtcAgoraV1Prompt } from "./prompt-source.js";
import type { AgoraAgentSession, AgoraConversationAgentConfig } from "./types.js";

function agentIdFrom(response: Record<string, unknown>): string | undefined {
  for (const candidate of [response.agent_id, response.agentId, response.id]) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return undefined;
}

function safeProviderField(body: unknown, field: "detail" | "reason"): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value.slice(0, 500) : undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class AgoraConversationAgentClient {
  private readonly activeAgents = new Set<string>();
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
    callId: string;
  }): Promise<AgoraAgentSession> {
    const { pipeline_id: pipelineId, ...properties } = this.config.properties;
    if (typeof pipelineId !== "string" || pipelineId.length === 0) {
      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Agora CAI pipeline is not configured.",
        false
      );
    }
    const promptProperties = withCtcAgoraV1Prompt(properties);
    const response = await this.request(
      `/api/conversational-ai-agent/v2/projects/${this.config.appId}/join`,
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          pipeline_id: pipelineId,
          properties: {
            ...promptProperties,
            channel: input.channelName,
            token: input.agentToken,
            agent_rtc_uid: String(input.agentUid),
            agent_rtm_uid: String(input.agentUid),
            remote_rtc_uids: [String(input.customerUid)],
            advanced_features: { enable_rtm: true },
            parameters: { data_channel: "rtm" }
          },
          labels: { call_id: input.callId, schema_version: "ctc-v1" }
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
    this.activeAgents.add(agentId);
    return { agentId, name: input.name };
  }

  async stop(agentId: string): Promise<void> {
    if (!this.activeAgents.has(agentId)) {
      throw new AgoraAdapterError(
        "AGORA_CHANNEL_UNAVAILABLE",
        "Agora agent session is no longer available.",
        true
      );
    }
    await this.request(
      `/api/conversational-ai-agent/v2/projects/${this.config.appId}/agents/${encodeURIComponent(agentId)}/leave`,
      { method: "POST" }
    );
    this.activeAgents.delete(agentId);
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetchImpl(new URL(path, this.config.baseUrl), {
        ...init,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.customerId}:${this.config.customerSecret}`).toString("base64")}`,
          "Content-Type": "application/json"
        }
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AgoraAdapterError(
          "AGORA_CHANNEL_UNAVAILABLE",
          "Agora Conversation AI Engine is unavailable.",
          isRetryableStatus(response.status),
          response.status,
          safeProviderField(body, "detail"),
          safeProviderField(body, "reason")
        );
      }
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
