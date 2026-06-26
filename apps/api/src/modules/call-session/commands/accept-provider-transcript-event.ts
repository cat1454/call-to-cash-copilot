import type { DatabaseClient } from "@call-to-cash/db";

import { appendTranscriptTurn } from "./append-transcript-turn.js";

/** The only durable admission point for every trusted provider transcript source. */
export async function acceptProviderTranscriptEvent(
  client: DatabaseClient,
  input: {
    callId: string;
    provider: "agora-conversation-ai";
    providerEventId: string;
    providerTurnId: string;
    speaker: "CUSTOMER" | "AGENT";
    text: string;
    isFinal: boolean;
    occurredAt: string;
    receivedAt: string;
    channelName: string;
    sessionId: string;
    requestId: string;
    sequenceNo?: number;
    language?: string;
  }
) {
  if (!input.isFinal) return { accepted: false, persisted: false, duplicate: false };
  const result = await appendTranscriptTurn(client, {
    callId: input.callId,
    requestId: input.requestId,
    trustedPostSessionIngress: true,
    turn: {
      clientTurnId: input.providerTurnId,
      provider: input.provider,
      providerTurnId: input.providerTurnId,
      // The database assigns the authoritative sequence, never the provider.
      sequenceNo: input.sequenceNo ?? 1,
      speaker: input.speaker,
      content: input.text,
      language: input.language ?? "vi-VN",
      isFinal: true,
      source: "AGORA",
      endedAt: input.occurredAt
    }
  });
  return { ...result, persisted: !result.duplicate };
}
