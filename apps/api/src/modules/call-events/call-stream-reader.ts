import type { DatabaseClient } from "@call-to-cash/db";
import { EventEnvelopeSchema } from "@call-to-cash/shared";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import type { CallEventCursor, CallEvents } from "./types.js";

export async function readCommittedCallEvents(
  client: DatabaseClient,
  callId: string,
  lastEventId?: CallEventCursor
): Promise<CallEvents> {
  const call = await client.callSession.findUnique({ where: { publicId: callId } });
  if (call === null) {
    throw new ApiCommandError(404, "CALL_NOT_FOUND", "Call session was not found.");
  }
  const rows = await client.auditLog.findMany({
    where: { aggregateType: "CALL_STREAM", aggregateId: callId, eventId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { afterState: true }
  });
  const events = rows
    .map((row) => EventEnvelopeSchema.safeParse(row.afterState))
    .filter((result) => result.success)
    .map((result) => result.data)
    .sort((left, right) => left.sequence - right.sequence);
  if (lastEventId === undefined) {
    return events;
  }
  const index = events.findIndex((event) => event.eventId === lastEventId);
  return index === -1 ? events : events.slice(index + 1);
}
