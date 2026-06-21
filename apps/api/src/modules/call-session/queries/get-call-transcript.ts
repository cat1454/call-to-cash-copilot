import type { DatabaseClient } from "@call-to-cash/db";

import { ApiCommandError } from "../../../platform/http/api-command-error.js";
import type { ServiceData } from "../types.js";

export async function getCallTranscript(
  client: DatabaseClient,
  callId: string
): Promise<ServiceData> {
  const call = await client.callSession.findUnique({ where: { publicId: callId } });
  if (call === null) throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
  const turns = await client.transcriptTurn.findMany({
    where: { callSessionId: call.id, isFinal: true },
    orderBy: { sequenceNo: "asc" }
  });
  return {
    callId,
    turns: turns.map((turn) => ({
      turnId: turn.publicId,
      callId,
      sequenceNo: turn.sequenceNo,
      speaker: turn.speaker,
      content: turn.contentRedacted,
      language: turn.language,
      isFinal: turn.isFinal,
      startedAt: turn.startedAt?.toISOString() ?? null,
      endedAt: turn.endedAt?.toISOString() ?? null,
      sttConfidence: turn.sttConfidence === null ? null : Number(turn.sttConfidence),
      source: turn.source,
      createdAt: turn.createdAt.toISOString()
    }))
  };
}
