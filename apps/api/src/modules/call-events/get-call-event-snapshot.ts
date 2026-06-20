import type { DatabaseClient } from "@call-to-cash/db";

import { readCommittedCallEvents } from "./call-stream-reader.js";
import type { CallEventCursor, CallEvents } from "./types.js";

export function getCallEventSnapshot(
  client: DatabaseClient,
  callId: string,
  cursor?: CallEventCursor
): Promise<CallEvents> {
  return readCommittedCallEvents(client, callId, cursor);
}
