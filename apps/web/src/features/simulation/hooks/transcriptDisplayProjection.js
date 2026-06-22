import { normalizeTranscriptDisplayText } from "@call-to-cash/shared";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/gu;

export function sanitizePublicText(value) {
  if (typeof value !== "string") return "";
  const masked = value.replace(EMAIL_PATTERN, "[EMAIL]").replace(PHONE_PATTERN, "[PHONE]");
  return normalizeTranscriptDisplayText(masked);
}

export function projectTranscriptTurnForDisplay(turn) {
  const sender = turn.speaker === "CUSTOMER" ? "customer" : "ai";
  return {
    sender,
    text: sanitizePublicText(turn.content),
    turnId: turn.turnId,
    ...((turn.createdAt ?? turn.endedAt ?? turn.timestamp)
      ? { timestamp: turn.createdAt ?? turn.endedAt ?? turn.timestamp }
      : {})
  };
}
