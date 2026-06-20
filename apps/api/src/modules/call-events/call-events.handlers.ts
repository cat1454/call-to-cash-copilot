import type { DatabaseClient } from "@call-to-cash/db";
import type { FastifyReply } from "fastify";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { getCallEventSnapshot } from "./get-call-event-snapshot.js";
import { subscribeCallEvents } from "./subscribe-call-events.js";
import type { CallEventCursor, CallEvents } from "./types.js";

function requireDatabaseClient(databaseClient?: DatabaseClient): DatabaseClient {
  if (databaseClient === undefined) {
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  }
  return databaseClient;
}

export function createCallEventHandlers(databaseClient?: DatabaseClient) {
  return {
    snapshot(callId: string, cursor?: CallEventCursor): Promise<CallEvents> {
      return getCallEventSnapshot(requireDatabaseClient(databaseClient), callId, cursor);
    },
    subscribe(
      reply: FastifyReply,
      callId: string,
      cursor?: CallEventCursor
    ): Promise<FastifyReply> {
      return subscribeCallEvents(reply, requireDatabaseClient(databaseClient), callId, cursor);
    }
  };
}
