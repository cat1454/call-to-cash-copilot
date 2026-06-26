import type { RtmTranscriptFrame } from "./rtm-transcript-frame.js";

export type RtmDeliveryMode = "immediate" | "debounced";

type Schedule = (callback: () => void, delayMs: number) => unknown;
type Cancel = (handle: unknown) => void;

export function deliveryModeForRtmFrame(rawMessage: unknown): RtmDeliveryMode {
  if (typeof rawMessage !== "string") return "immediate";
  try {
    const payload = JSON.parse(rawMessage) as Record<string, unknown>;
    if (payload.object !== "assistant.transcription") return "immediate";
    const status =
      typeof payload.turn_status === "string"
        ? payload.turn_status.trim().toLowerCase()
        : payload.turn_status;
    return status === undefined ||
      status === 0 ||
      status === "0" ||
      status === "partial" ||
      status === "in_progress"
      ? "debounced"
      : "immediate";
  } catch {
    return "immediate";
  }
}

export class AssistantTurnBuffer {
  private readonly pending = new Map<string, { event: RtmTranscriptFrame; handle: unknown }>();
  private readonly forwarded = new Set<string>();

  constructor(
    private readonly forward: (event: RtmTranscriptFrame) => Promise<void>,
    private readonly delayMs = 500,
    private readonly schedule: Schedule = (callback, delay) => setTimeout(callback, delay),
    private readonly cancel: Cancel = (handle) => clearTimeout(handle as NodeJS.Timeout),
    private readonly onError: (error: unknown) => void = () => undefined
  ) {}

  push(event: RtmTranscriptFrame, mode: RtmDeliveryMode): void {
    if (this.forwarded.has(event.eventId)) return;
    const existing = this.pending.get(event.eventId);
    if (existing !== undefined) this.cancel(existing.handle);

    if (mode === "immediate") {
      this.pending.delete(event.eventId);
      this.forwarded.add(event.eventId);
      void this.forward(event).catch(this.onError);
      return;
    }

    const handle = this.schedule(() => {
      const latest = this.pending.get(event.eventId);
      if (latest === undefined || this.forwarded.has(event.eventId)) return;
      this.pending.delete(event.eventId);
      this.forwarded.add(event.eventId);
      void this.forward(latest.event).catch(this.onError);
    }, this.delayMs);
    this.pending.set(event.eventId, { event, handle });
  }

  async flush(): Promise<void> {
    const events = [...this.pending.values()].map(({ event, handle }) => {
      this.cancel(handle);
      return event;
    });
    this.pending.clear();
    for (const event of events) {
      if (this.forwarded.has(event.eventId)) continue;
      this.forwarded.add(event.eventId);
      await this.forward(event);
    }
  }
}
