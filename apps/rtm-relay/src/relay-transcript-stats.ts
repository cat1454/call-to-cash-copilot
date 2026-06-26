import type { ParseRtmTranscriptFrameResult } from "./rtm-transcript-frame.js";
import { assistantTextSource } from "./rtm-transcript-frame.js";

type RejectionReason = Extract<ParseRtmTranscriptFrameResult, { accepted: false }>["reason"];

export class RelayTranscriptStats {
  private readonly received = { customer: 0, agent: 0, unknown: 0 };
  private readonly accepted = { customer: 0, agent: 0 };
  private readonly assistantText = { direct: 0, alternate: 0, missing: 0, nonString: 0 };
  private readonly rejected: Partial<Record<RejectionReason, number>> = {};
  private readonly rejectedBySource = {
    customer: {} as Partial<Record<RejectionReason, number>>,
    agent: {} as Partial<Record<RejectionReason, number>>,
    unknown: {} as Partial<Record<RejectionReason, number>>
  };
  private readonly forwardFailed = { customer: 0, agent: 0 };

  private sourceFor(rawMessage: unknown): "customer" | "agent" | "unknown" {
    if (typeof rawMessage !== "string") {
      return "unknown";
    }
    try {
      const payload = JSON.parse(rawMessage) as Record<string, unknown>;
      if (payload.object === "user.transcription") return "customer";
      if (payload.object === "assistant.transcription") return "agent";
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  recordReceived(rawMessage: unknown): void {
    const source = this.sourceFor(rawMessage);
    this.received[source] += 1;
    if (source !== "agent" || typeof rawMessage !== "string") return;
    try {
      const payload = JSON.parse(rawMessage) as Record<string, unknown>;
      if (payload.object === "assistant.transcription") {
        const textSource = assistantTextSource(payload);
        if (textSource !== undefined) this.assistantText[textSource] += 1;
      }
    } catch {
      return;
    }
  }

  recordAccepted(speaker: "CUSTOMER" | "AGENT"): void {
    this.accepted[speaker === "CUSTOMER" ? "customer" : "agent"] += 1;
  }

  recordRejected(reason: RejectionReason, rawMessage?: unknown): void {
    this.rejected[reason] = (this.rejected[reason] ?? 0) + 1;
    const source = this.sourceFor(rawMessage);
    this.rejectedBySource[source][reason] = (this.rejectedBySource[source][reason] ?? 0) + 1;
  }

  recordForwardFailed(speaker: "CUSTOMER" | "AGENT"): void {
    this.forwardFailed[speaker === "CUSTOMER" ? "customer" : "agent"] += 1;
  }

  snapshot(activeSessions: number) {
    return {
      activeSessions,
      received: { ...this.received },
      accepted: { ...this.accepted },
      assistantText: { ...this.assistantText },
      rejected: { ...this.rejected },
      rejectedBySource: {
        customer: { ...this.rejectedBySource.customer },
        agent: { ...this.rejectedBySource.agent },
        unknown: { ...this.rejectedBySource.unknown }
      },
      forwardFailed: { ...this.forwardFailed }
    };
  }
}
