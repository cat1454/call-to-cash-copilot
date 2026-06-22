import { normalizeTranscriptDisplayText } from "@call-to-cash/shared";

import { AgoraTranscriptProviderEventSchema } from "./provider-events.js";
import type { NormalizedTranscriptTurn } from "./types.js";

export function normalizeTranscriptEvent(input: unknown): NormalizedTranscriptTurn {
  const event = AgoraTranscriptProviderEventSchema.parse(input);
  return {
    providerTurnId: event.turn.id,
    sequenceNo: event.turn.sequenceNo,
    speaker: event.turn.speaker,
    content: normalizeTranscriptDisplayText(event.turn.text),
    language: event.turn.language,
    isFinal: event.turn.final,
    ...(event.turn.startedAt === undefined ? {} : { startedAt: event.turn.startedAt }),
    ...(event.turn.endedAt === undefined ? {} : { endedAt: event.turn.endedAt }),
    ...(event.turn.confidence === undefined ? {} : { sttConfidence: event.turn.confidence })
  };
}
