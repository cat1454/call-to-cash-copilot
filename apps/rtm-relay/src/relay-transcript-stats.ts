import type { ParseRtmTranscriptFrameResult } from "./rtm-transcript-frame.js";
import { assistantTextSource } from "./rtm-transcript-frame.js";

type RejectionReason = Extract<ParseRtmTranscriptFrameResult, { accepted: false }>["reason"];

export class RelayTranscriptStats {
  private readonly received = { customer: 0, agent: 0, unknown: 0 };
  private readonly accepted = { customer: 0, agent: 0 };
  private readonly assistantText = { direct: 0, alternate: 0, missing: 0, nonString: 0 };
  private readonly rejected: Partial<Record<RejectionReason, number>> = {};

  recordReceived(rawMessage: unknown): void {
    if (typeof rawMessage !== "string") {
      this.received.unknown += 1;
      return;
    }
    try {
      const payload = JSON.parse(rawMessage) as Record<string, unknown>;
      if (payload.object === "user.transcription") this.received.customer += 1;
      else if (payload.object === "assistant.transcription") {
        this.received.agent += 1;
        const source = assistantTextSource(payload);
        if (source !== undefined) this.assistantText[source] += 1;
      } else this.received.unknown += 1;
    } catch {
      this.received.unknown += 1;
    }
  }

  recordAccepted(speaker: "CUSTOMER" | "AGENT"): void {
    this.accepted[speaker === "CUSTOMER" ? "customer" : "agent"] += 1;
  }

  recordRejected(reason: RejectionReason): void {
    this.rejected[reason] = (this.rejected[reason] ?? 0) + 1;
  }

  snapshot(activeSessions: number) {
    return {
      activeSessions,
      received: { ...this.received },
      accepted: { ...this.accepted },
      assistantText: { ...this.assistantText },
      rejected: { ...this.rejected }
    };
  }
}
